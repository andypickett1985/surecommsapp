#include <pjsua-lib/pjsua.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

#define MAX_LINE 4096
#define CAPTURE_BUF_SIZE 640

static pjsua_acc_id g_acc_id = PJSUA_INVALID_ID;
static pjsua_call_id g_call_id = PJSUA_INVALID_ID;
static int g_running = 1;
static int g_audio_capture = 0;
static pjmedia_port *g_capture_port = NULL;
static pjsua_conf_port_id g_capture_slot = PJSUA_INVALID_ID;
static pjmedia_port *g_capture_local = NULL;
static pjsua_conf_port_id g_capture_local_slot = PJSUA_INVALID_ID;

static const char b64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void base64_encode(const unsigned char *data, int len, char *out) {
    int i, j = 0;
    for (i = 0; i < len; i += 3) {
        int b = (data[i] << 16) | ((i+1 < len ? data[i+1] : 0) << 8) | (i+2 < len ? data[i+2] : 0);
        out[j++] = b64_table[(b >> 18) & 0x3F];
        out[j++] = b64_table[(b >> 12) & 0x3F];
        out[j++] = (i+1 < len) ? b64_table[(b >> 6) & 0x3F] : '=';
        out[j++] = (i+2 < len) ? b64_table[b & 0x3F] : '=';
    }
    out[j] = 0;
}

static void emit_audio(const char* speaker, pjmedia_frame *frame) {
    int b64_len = ((frame->size + 2) / 3) * 4 + 1;
    char *b64 = (char*)malloc(b64_len + 200);
    if (!b64) return;

    char *pcm_b64 = b64 + 100;
    base64_encode((const unsigned char*)frame->buf, (int)frame->size, pcm_b64);

    int written = snprintf(b64, 100 + b64_len, "{\"event\":\"audioData\",\"speaker\":\"%s\",\"pcm\":\"%s\"}\n", speaker, pcm_b64);
    fwrite(b64, 1, written, stdout);
    fflush(stdout);

    free(b64);
}

static pj_status_t capture_remote_put(pjmedia_port *port, pjmedia_frame *frame) {
    if (!g_audio_capture || frame->type != PJMEDIA_FRAME_TYPE_AUDIO || frame->size == 0) return PJ_SUCCESS;
    emit_audio("remote", frame);
    return PJ_SUCCESS;
}

static pj_status_t capture_local_put(pjmedia_port *port, pjmedia_frame *frame) {
    if (!g_audio_capture || frame->type != PJMEDIA_FRAME_TYPE_AUDIO || frame->size == 0) return PJ_SUCCESS;
    emit_audio("local", frame);
    return PJ_SUCCESS;
}

static pj_status_t capture_get_frame(pjmedia_port *port, pjmedia_frame *frame) {
    frame->type = PJMEDIA_FRAME_TYPE_NONE;
    frame->size = 0;
    return PJ_SUCCESS;
}

static void emit(const char* fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stdout, fmt, ap);
    va_end(ap);
    fprintf(stdout, "\n");
    fflush(stdout);
}

static void on_reg_state2(pjsua_acc_id acc_id, pjsua_reg_info *info) {
    int code = info->cbparam->code;
    emit("{\"event\":\"regState\",\"code\":%d,\"reason\":\"\"}", code);
}

static void on_incoming_call(pjsua_acc_id acc_id, pjsua_call_id call_id, pjsip_rx_data *rdata) {
    pjsua_call_info ci;
    pjsua_call_get_info(call_id, &ci);
    g_call_id = call_id;

    char remote[256] = {0};
    pj_memcpy(remote, ci.remote_info.ptr, ci.remote_info.slen < 255 ? ci.remote_info.slen : 255);

    emit("{\"event\":\"incomingCall\",\"callId\":%d,\"number\":\"%s\",\"name\":\"\"}", call_id, remote);

    pjsua_call_answer(call_id, 180, NULL, NULL);
}

static void on_call_state(pjsua_call_id call_id, pjsip_event *e) {
    pjsua_call_info ci;
    pjsua_call_get_info(call_id, &ci);

    const char* state_str = "unknown";
    switch (ci.state) {
        case PJSIP_INV_STATE_CALLING: state_str = "calling"; break;
        case PJSIP_INV_STATE_INCOMING: state_str = "incoming"; break;
        case PJSIP_INV_STATE_EARLY: state_str = "early"; break;
        case PJSIP_INV_STATE_CONNECTING: state_str = "connecting"; break;
        case PJSIP_INV_STATE_CONFIRMED: state_str = "confirmed"; break;
        case PJSIP_INV_STATE_DISCONNECTED:
            state_str = "disconnected";
            if (call_id == g_call_id) g_call_id = PJSUA_INVALID_ID;
            break;
        default: break;
    }

    char remote[256] = {0};
    pj_memcpy(remote, ci.remote_info.ptr, ci.remote_info.slen < 255 ? ci.remote_info.slen : 255);

    emit("{\"event\":\"callState\",\"callId\":%d,\"state\":\"%s\",\"number\":\"%s\"}", call_id, state_str, remote);
}

static void on_call_media_state(pjsua_call_id call_id) {
    pjsua_call_info ci;
    pjsua_call_get_info(call_id, &ci);
    for (unsigned i = 0; i < ci.media_cnt; i++) {
        if (ci.media[i].type == PJMEDIA_TYPE_AUDIO && ci.media[i].status == PJSUA_CALL_MEDIA_ACTIVE) {
            pjsua_conf_connect(ci.media[i].stream.aud.conf_slot, 0);
            pjsua_conf_connect(0, ci.media[i].stream.aud.conf_slot);
            /* Connect remote audio to remote capture, local mic to local capture */
            if (g_capture_slot != PJSUA_INVALID_ID) {
                pjsua_conf_connect(ci.media[i].stream.aud.conf_slot, g_capture_slot);
            }
            if (g_capture_local_slot != PJSUA_INVALID_ID) {
                pjsua_conf_connect(0, g_capture_local_slot);
            }
        }
    }
}

static int init_pjsua() {
    pj_status_t status = pjsua_create();
    if (status != PJ_SUCCESS) return -1;

    pjsua_config ua_cfg;
    pjsua_config_default(&ua_cfg);
    ua_cfg.cb.on_reg_state2 = &on_reg_state2;
    ua_cfg.cb.on_incoming_call = &on_incoming_call;
    ua_cfg.cb.on_call_state = &on_call_state;
    ua_cfg.cb.on_call_media_state = &on_call_media_state;
    ua_cfg.max_calls = 4;
    ua_cfg.user_agent = pj_str("SureCloudVoice/1.0");

    pjsua_logging_config log_cfg;
    pjsua_logging_config_default(&log_cfg);
    log_cfg.console_level = 0;

    pjsua_media_config media_cfg;
    pjsua_media_config_default(&media_cfg);

    status = pjsua_init(&ua_cfg, &log_cfg, &media_cfg);
    if (status != PJ_SUCCESS) return -1;

    pjsua_transport_config tcp_cfg;
    pjsua_transport_config_default(&tcp_cfg);
    pjsua_transport_create(PJSIP_TRANSPORT_UDP, &tcp_cfg, NULL);
    pjsua_transport_create(PJSIP_TRANSPORT_TCP, &tcp_cfg, NULL);

    status = pjsua_start();
    if (status != PJ_SUCCESS) return -1;

    /* Create two capture ports: one for remote audio, one for local mic */
    {
        pj_pool_t *pool = pjsua_pool_create("capture", 8000, 4000);
        pj_str_t rname = pj_str("cap_remote");
        pj_str_t lname = pj_str("cap_local");

        g_capture_port = (pjmedia_port*)pj_pool_zalloc(pool, sizeof(pjmedia_port));
        pjmedia_port_info_init(&g_capture_port->info, &rname, 0x12345678, 16000, 1, 16, 320);
        g_capture_port->put_frame = &capture_remote_put;
        g_capture_port->get_frame = &capture_get_frame;
        pjsua_conf_add_port(pool, g_capture_port, &g_capture_slot);

        g_capture_local = (pjmedia_port*)pj_pool_zalloc(pool, sizeof(pjmedia_port));
        pjmedia_port_info_init(&g_capture_local->info, &lname, 0x12345679, 16000, 1, 16, 320);
        g_capture_local->put_frame = &capture_local_put;
        g_capture_local->get_frame = &capture_get_frame;
        pjsua_conf_add_port(pool, g_capture_local, &g_capture_local_slot);
    }

    emit("{\"event\":\"ready\"}");
    return 0;
}

static char* json_str(const char* json, const char* key, char* buf, int bufsz) {
    buf[0] = 0;
    char search[128];
    snprintf(search, sizeof(search), "\"%s\":\"", key);
    const char* p = strstr(json, search);
    if (!p) return buf;
    p += strlen(search);
    const char* end = strchr(p, '"');
    if (!end) return buf;
    int len = (int)(end - p);
    if (len >= bufsz) len = bufsz - 1;
    strncpy(buf, p, len);
    buf[len] = 0;
    return buf;
}

static int json_bool(const char* json, const char* key) {
    char search[128];
    snprintf(search, sizeof(search), "\"%s\":true", key);
    return strstr(json, search) != NULL;
}

static void handle_command(const char* line) {
    char cmd[64], buf1[256], buf2[256], buf3[256], buf4[256], buf5[256];
    json_str(line, "cmd", cmd, sizeof(cmd));

    if (strcmp(cmd, "configure") == 0) {
        char displayName[256];
        json_str(line, "server", buf1, sizeof(buf1));
        json_str(line, "username", buf2, sizeof(buf2));
        json_str(line, "password", buf3, sizeof(buf3));
        json_str(line, "domain", buf4, sizeof(buf4));
        json_str(line, "transport", buf5, sizeof(buf5));
        json_str(line, "displayName", displayName, sizeof(displayName));

        if (g_acc_id != PJSUA_INVALID_ID) {
            pjsua_acc_del(g_acc_id);
            g_acc_id = PJSUA_INVALID_ID;
        }

        pjsua_acc_config acc_cfg;
        pjsua_acc_config_default(&acc_cfg);

        char id_uri[512], reg_uri[512];
        const char* domain = buf4[0] ? buf4 : buf1;
        if (displayName[0]) {
            snprintf(id_uri, sizeof(id_uri), "\"%s\" <sip:%s@%s>", displayName, buf2, domain);
        } else {
            snprintf(id_uri, sizeof(id_uri), "sip:%s@%s", buf2, domain);
        }
        snprintf(reg_uri, sizeof(reg_uri), "sip:%s", buf1);

        acc_cfg.id = pj_str(id_uri);
        acc_cfg.reg_uri = pj_str(reg_uri);
        acc_cfg.cred_count = 1;
        acc_cfg.cred_info[0].realm = pj_str("*");
        acc_cfg.cred_info[0].scheme = pj_str("digest");
        acc_cfg.cred_info[0].username = pj_str(buf2);
        acc_cfg.cred_info[0].data_type = PJSIP_CRED_DATA_PLAIN_PASSWD;
        acc_cfg.cred_info[0].data = pj_str(buf3);

        if (strcmp(buf5, "tcp") == 0) {
            acc_cfg.transport_id = 1;
        }

        pj_status_t status = pjsua_acc_add(&acc_cfg, PJ_TRUE, &g_acc_id);
        if (status != PJ_SUCCESS) {
            emit("{\"event\":\"regState\",\"code\":-1,\"reason\":\"Account add failed\"}");
        }
    }
    else if (strcmp(cmd, "makeCall") == 0) {
        json_str(line, "number", buf1, sizeof(buf1));
        char uri[512];
        if (g_acc_id != PJSUA_INVALID_ID) {
            pjsua_acc_info ai;
            pjsua_acc_get_info(g_acc_id, &ai);
            char domain[256] = {0};
            const char* at = strchr(ai.acc_uri.ptr, '@');
            if (at) {
                const char* end = strchr(at, '>');
                if (!end) end = ai.acc_uri.ptr + ai.acc_uri.slen;
                int dlen = (int)(end - at - 1);
                strncpy(domain, at + 1, dlen < 255 ? dlen : 255);
            }
            snprintf(uri, sizeof(uri), "sip:%s@%s", buf1, domain);
        } else {
            snprintf(uri, sizeof(uri), "sip:%s", buf1);
        }
        pj_str_t dest = pj_str(uri);
        pjsua_call_make_call(g_acc_id, &dest, 0, NULL, NULL, &g_call_id);
    }
    else if (strcmp(cmd, "hangup") == 0) {
        if (g_call_id != PJSUA_INVALID_ID)
            pjsua_call_hangup(g_call_id, 0, NULL, NULL);
    }
    else if (strcmp(cmd, "answer") == 0) {
        if (g_call_id != PJSUA_INVALID_ID)
            pjsua_call_answer(g_call_id, 200, NULL, NULL);
    }
    else if (strcmp(cmd, "decline") == 0) {
        if (g_call_id != PJSUA_INVALID_ID)
            pjsua_call_hangup(g_call_id, 486, NULL, NULL);
    }
    else if (strcmp(cmd, "toggleMute") == 0) {
        if (g_call_id != PJSUA_INVALID_ID) {
            pjsua_call_info ci;
            pjsua_call_get_info(g_call_id, &ci);
            int muted = json_bool(line, "muted");
            for (unsigned i = 0; i < ci.media_cnt; i++) {
                if (ci.media[i].type == PJMEDIA_TYPE_AUDIO && ci.media[i].status == PJSUA_CALL_MEDIA_ACTIVE) {
                    if (muted) pjsua_conf_disconnect(0, ci.media[i].stream.aud.conf_slot);
                    else pjsua_conf_connect(0, ci.media[i].stream.aud.conf_slot);
                }
            }
        }
    }
    else if (strcmp(cmd, "toggleHold") == 0) {
        if (g_call_id != PJSUA_INVALID_ID) {
            if (json_bool(line, "held")) pjsua_call_set_hold(g_call_id, NULL);
            else pjsua_call_reinvite(g_call_id, PJSUA_CALL_UNHOLD, NULL);
        }
    }
    else if (strcmp(cmd, "dtmf") == 0) {
        json_str(line, "digit", buf1, sizeof(buf1));
        if (g_call_id != PJSUA_INVALID_ID && buf1[0]) {
            pj_str_t digits = pj_str(buf1);
            pjsua_call_dial_dtmf(g_call_id, &digits);
        }
    }
    else if (strcmp(cmd, "transfer") == 0) {
        json_str(line, "number", buf1, sizeof(buf1));
        if (g_call_id != PJSUA_INVALID_ID && buf1[0]) {
            char uri[512];
            snprintf(uri, sizeof(uri), "sip:%s", buf1);
            pj_str_t dest = pj_str(uri);
            pjsua_call_xfer(g_call_id, &dest, NULL);
        }
    }
    else if (strcmp(cmd, "enableAudioCapture") == 0) {
        g_audio_capture = json_bool(line, "enabled");
        emit("{\"event\":\"audioCaptureState\",\"enabled\":%s}", g_audio_capture ? "true" : "false");
    }
    else if (strcmp(cmd, "quit") == 0) {
        g_running = 0;
    }
}

int main() {
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_TEXT);
    _setmode(_fileno(stdout), _O_TEXT);
#endif

    if (init_pjsua() != 0) {
        emit("{\"event\":\"error\",\"reason\":\"Failed to initialize SIP engine\"}");
        return 1;
    }

    char line[MAX_LINE];
    while (g_running && fgets(line, sizeof(line), stdin)) {
        int len = (int)strlen(line);
        while (len > 0 && (line[len-1] == '\n' || line[len-1] == '\r')) line[--len] = 0;
        if (len > 0) handle_command(line);
    }

    if (g_acc_id != PJSUA_INVALID_ID) pjsua_acc_del(g_acc_id);
    pjsua_destroy();
    return 0;
}
