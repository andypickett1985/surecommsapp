--
-- PostgreSQL database dump
--

\restrict 4RT10rxtRWOQVHqdDuwIYjBRsaU0phlFc1kDK8VJF71eDg2keKv4wOmaqQ1INEp

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.admins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'admin'::character varying,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT admins_role_check CHECK (((role)::text = ANY ((ARRAY['superadmin'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.admins OWNER TO surecloudcomms;

--
-- Name: app_versions; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.app_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version character varying(50) NOT NULL,
    platform character varying(20) DEFAULT 'windows'::character varying,
    download_url text,
    release_notes text,
    force_update boolean DEFAULT false,
    published boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.app_versions OWNER TO surecloudcomms;

--
-- Name: blf_buttons; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.blf_buttons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    label character varying(255),
    number character varying(100),
    btn_type character varying(20) DEFAULT 'speeddial'::character varying,
    "position" integer DEFAULT 0,
    url text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT blf_buttons_btn_type_check CHECK (((btn_type)::text = ANY ((ARRAY['blf'::character varying, 'speeddial'::character varying, 'emergency'::character varying, 'webpage'::character varying])::text[])))
);


ALTER TABLE public.blf_buttons OWNER TO surecloudcomms;

--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp without time zone DEFAULT now(),
    last_read_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.conversation_participants OWNER TO surecloudcomms;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    title character varying(255),
    type character varying(20) DEFAULT 'direct'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT conversations_type_check CHECK (((type)::text = ANY ((ARRAY['direct'::character varying, 'group'::character varying, 'sms'::character varying])::text[])))
);


ALTER TABLE public.conversations OWNER TO surecloudcomms;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    device_name character varying(255),
    device_type character varying(50) DEFAULT 'windows'::character varying,
    last_ip character varying(45),
    last_seen timestamp without time zone,
    provisioned_at timestamp without time zone DEFAULT now(),
    active boolean DEFAULT true,
    app_version character varying(50),
    os_version character varying(100),
    online boolean DEFAULT false,
    last_config_version integer DEFAULT 0,
    ws_connected_at timestamp without time zone
);


ALTER TABLE public.devices OWNER TO surecloudcomms;

--
-- Name: diagnostic_logs; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.diagnostic_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    tenant_id uuid,
    log_type character varying(20) DEFAULT 'sip_log'::character varying,
    filename character varying(255),
    file_path text,
    file_size integer,
    node character varying(100),
    extension character varying(20),
    duration integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT diagnostic_logs_log_type_check CHECK (((log_type)::text = ANY ((ARRAY['sip_log'::character varying, 'sip_capture'::character varying, 'app_log'::character varying])::text[])))
);


ALTER TABLE public.diagnostic_logs OWNER TO surecloudcomms;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid,
    body text NOT NULL,
    msg_type character varying(20) DEFAULT 'text'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT messages_msg_type_check CHECK (((msg_type)::text = ANY ((ARRAY['text'::character varying, 'sms'::character varying, 'system'::character varying, 'file'::character varying])::text[])))
);


ALTER TABLE public.messages OWNER TO surecloudcomms;

--
-- Name: org_settings; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.org_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text
);


ALTER TABLE public.org_settings OWNER TO surecloudcomms;

--
-- Name: sip_accounts; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.sip_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    label character varying(255),
    sip_server character varying(255) NOT NULL,
    sip_proxy character varying(255),
    sip_domain character varying(255),
    sip_username character varying(255) NOT NULL,
    sip_password character varying(255) NOT NULL,
    auth_id character varying(255),
    display_name character varying(255),
    voicemail_number character varying(50),
    dialing_prefix character varying(20),
    dial_plan character varying(255),
    transport character varying(10) DEFAULT 'udp'::character varying,
    srtp character varying(20) DEFAULT 'disabled'::character varying,
    public_addr character varying(255),
    register_refresh integer DEFAULT 300,
    keep_alive integer DEFAULT 15,
    publish boolean DEFAULT false,
    ice boolean DEFAULT false,
    allow_rewrite boolean DEFAULT true,
    disable_session_timer boolean DEFAULT false,
    hide_cid boolean DEFAULT false,
    config_version integer DEFAULT 1,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT sip_accounts_srtp_check CHECK (((srtp)::text = ANY ((ARRAY['disabled'::character varying, 'optional'::character varying, 'mandatory'::character varying])::text[]))),
    CONSTRAINT sip_accounts_transport_check CHECK (((transport)::text = ANY ((ARRAY['udp'::character varying, 'tcp'::character varying, 'tls'::character varying])::text[])))
);


ALTER TABLE public.sip_accounts OWNER TO surecloudcomms;

--
-- Name: speed_dials; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.speed_dials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    target_user_id uuid,
    target_number character varying(50),
    label character varying(255),
    "position" integer DEFAULT 0,
    blf boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.speed_dials OWNER TO surecloudcomms;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    region character varying(100),
    package character varying(50) DEFAULT 'essentials'::character varying,
    sip_domain character varying(255),
    sip_port integer DEFAULT 5060,
    sip_protocol character varying(10) DEFAULT 'udp'::character varying,
    country_code character varying(10) DEFAULT '+44'::character varying,
    connection_name character varying(255),
    sip_proxy character varying(255),
    ringback_tone character varying(100) DEFAULT 'United Kingdom'::character varying,
    max_registrations integer DEFAULT 6,
    multi_tenant_mode boolean DEFAULT false,
    opus_codec boolean DEFAULT false,
    https_proxy character varying(255),
    fpbx_domain_uuid uuid,
    fpbx_synced_at timestamp without time zone
);


ALTER TABLE public.tenants OWNER TO surecloudcomms;

--
-- Name: transcriptions; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.transcriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    tenant_id uuid,
    call_number character varying(100),
    call_direction character varying(10),
    call_duration integer,
    transcript text,
    summary text,
    language character varying(20) DEFAULT 'en'::character varying,
    status character varying(20) DEFAULT 'complete'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.transcriptions OWNER TO surecloudcomms;

--
-- Name: user_presence; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.user_presence (
    user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'offline'::character varying,
    status_text character varying(255),
    last_seen timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_presence_status_check CHECK (((status)::text = ANY ((ARRAY['online'::character varying, 'away'::character varying, 'busy'::character varying, 'dnd'::character varying, 'offline'::character varying])::text[])))
);


ALTER TABLE public.user_presence OWNER TO surecloudcomms;

--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.user_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    setting_key character varying(100) NOT NULL,
    setting_value text
);


ALTER TABLE public.user_settings OWNER TO surecloudcomms;

--
-- Name: users; Type: TABLE; Schema: public; Owner: surecloudcomms
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    display_name character varying(255),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    fpbx_extension_uuid uuid
);


ALTER TABLE public.users OWNER TO surecloudcomms;

--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: app_versions app_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_pkey PRIMARY KEY (id);


--
-- Name: blf_buttons blf_buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.blf_buttons
    ADD CONSTRAINT blf_buttons_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: diagnostic_logs diagnostic_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.diagnostic_logs
    ADD CONSTRAINT diagnostic_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: org_settings org_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_pkey PRIMARY KEY (id);


--
-- Name: org_settings org_settings_tenant_id_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_tenant_id_setting_key_key UNIQUE (tenant_id, setting_key);


--
-- Name: sip_accounts sip_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.sip_accounts
    ADD CONSTRAINT sip_accounts_pkey PRIMARY KEY (id);


--
-- Name: speed_dials speed_dials_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.speed_dials
    ADD CONSTRAINT speed_dials_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: transcriptions transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_pkey PRIMARY KEY (id);


--
-- Name: user_presence user_presence_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_pkey PRIMARY KEY (user_id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_user_id_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_setting_key_key UNIQUE (user_id, setting_key);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_admins_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_admins_tenant ON public.admins USING btree (tenant_id);


--
-- Name: idx_blf_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_blf_tenant ON public.blf_buttons USING btree (tenant_id);


--
-- Name: idx_conv_participants; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_conv_participants ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_conv_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_conv_tenant ON public.conversations USING btree (tenant_id);


--
-- Name: idx_devices_user; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_devices_user ON public.devices USING btree (user_id);


--
-- Name: idx_diag_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_diag_tenant ON public.diagnostic_logs USING btree (tenant_id);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_org_settings_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_org_settings_tenant ON public.org_settings USING btree (tenant_id);


--
-- Name: idx_presence_status; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_presence_status ON public.user_presence USING btree (status);


--
-- Name: idx_sip_accounts_user; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_sip_accounts_user ON public.sip_accounts USING btree (user_id);


--
-- Name: idx_speed_dials_user; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_speed_dials_user ON public.speed_dials USING btree (user_id);


--
-- Name: idx_tenants_fpbx; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_tenants_fpbx ON public.tenants USING btree (fpbx_domain_uuid) WHERE (fpbx_domain_uuid IS NOT NULL);


--
-- Name: idx_transcriptions_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_transcriptions_tenant ON public.transcriptions USING btree (tenant_id);


--
-- Name: idx_transcriptions_user; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_transcriptions_user ON public.transcriptions USING btree (user_id, created_at DESC);


--
-- Name: idx_user_settings_user; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_user_settings_user ON public.user_settings USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_fpbx; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_users_fpbx ON public.users USING btree (fpbx_extension_uuid) WHERE (fpbx_extension_uuid IS NOT NULL);


--
-- Name: idx_users_tenant; Type: INDEX; Schema: public; Owner: surecloudcomms
--

CREATE INDEX idx_users_tenant ON public.users USING btree (tenant_id);


--
-- Name: admins admins_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: blf_buttons blf_buttons_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.blf_buttons
    ADD CONSTRAINT blf_buttons_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: devices devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: diagnostic_logs diagnostic_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.diagnostic_logs
    ADD CONSTRAINT diagnostic_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: diagnostic_logs diagnostic_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.diagnostic_logs
    ADD CONSTRAINT diagnostic_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: org_settings org_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.org_settings
    ADD CONSTRAINT org_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: sip_accounts sip_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.sip_accounts
    ADD CONSTRAINT sip_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: speed_dials speed_dials_target_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.speed_dials
    ADD CONSTRAINT speed_dials_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: speed_dials speed_dials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.speed_dials
    ADD CONSTRAINT speed_dials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transcriptions transcriptions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: transcriptions transcriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.transcriptions
    ADD CONSTRAINT transcriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_presence user_presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.user_presence
    ADD CONSTRAINT user_presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: surecloudcomms
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO surecloudcomms;


--
-- PostgreSQL database dump complete
--

\unrestrict 4RT10rxtRWOQVHqdDuwIYjBRsaU0phlFc1kDK8VJF71eDg2keKv4wOmaqQ1INEp

