const router = require('express').Router();
const fpbx = require('../fpbx-db');
const { authenticateToken } = require('../middleware/auth');

// Admin: Get contacts for an org (by fpbx_domain_uuid)
router.get('/admin/:domainUuid', authenticateToken, async (req, res) => {
  try {
    if (!['admin','superadmin'].includes(req.user.role)) return res.status(403).json({ error: 'Admin required' });

    const result = await fpbx.query(`
      SELECT c.contact_uuid, c.contact_name_given, c.contact_name_family, c.contact_organization,
             c.contact_nickname, c.contact_title, c.contact_category, c.contact_type,
             (SELECT json_agg(json_build_object('number', p.phone_number, 'label', p.phone_label, 'primary', p.phone_primary))
              FROM v_contact_phones p WHERE p.contact_uuid = c.contact_uuid AND p.phone_number IS NOT NULL AND p.phone_number != '') as phones,
             (SELECT json_agg(json_build_object('email', e.email_address, 'label', e.email_label))
              FROM v_contact_emails e WHERE e.contact_uuid = c.contact_uuid AND e.email_address IS NOT NULL AND e.email_address != '') as emails
      FROM v_contacts c
      WHERE c.domain_uuid = $1
      ORDER BY c.contact_name_family, c.contact_name_given
    `, [req.params.domainUuid]);

    const contacts = result.rows.map(c => ({
      id: c.contact_uuid,
      firstName: c.contact_name_given || '',
      lastName: c.contact_name_family || '',
      name: [c.contact_name_given, c.contact_name_family].filter(Boolean).join(' ') || c.contact_organization || 'Unknown',
      organization: c.contact_organization || '',
      category: c.contact_category || '',
      phones: c.phones || [],
      emails: c.emails || [],
    }));

    res.json(contacts);
  } catch (err) { console.error('FPBX contacts error:', err); res.status(500).json({ error: err.message }); }
});

// User: Get contacts for their domain (used by the softphone app)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = require('../db');
    // Get the user's tenant fpbx_domain_uuid
    const tenantResult = await db.query('SELECT fpbx_domain_uuid FROM tenants WHERE id = $1', [req.user.tenant_id]);
    const domainUuid = tenantResult.rows[0]?.fpbx_domain_uuid;
    if (!domainUuid) return res.json([]);

    const result = await fpbx.query(`
      SELECT c.contact_uuid, c.contact_name_given, c.contact_name_family, c.contact_organization,
             c.contact_category,
             (SELECT json_agg(json_build_object('number', p.phone_number, 'label', p.phone_label))
              FROM v_contact_phones p WHERE p.contact_uuid = c.contact_uuid AND p.phone_number IS NOT NULL AND p.phone_number != '') as phones,
             (SELECT json_agg(json_build_object('email', e.email_address))
              FROM v_contact_emails e WHERE e.contact_uuid = c.contact_uuid AND e.email_address IS NOT NULL AND e.email_address != '') as emails
      FROM v_contacts c
      WHERE c.domain_uuid = $1
      ORDER BY c.contact_name_family, c.contact_name_given
    `, [domainUuid]);

    const contacts = result.rows.map(c => ({
      id: c.contact_uuid,
      name: [c.contact_name_given, c.contact_name_family].filter(Boolean).join(' ') || c.contact_organization || 'Unknown',
      organization: c.contact_organization || '',
      category: c.contact_category || '',
      phones: c.phones || [],
      emails: c.emails || [],
    }));

    res.json(contacts);
  } catch (err) { console.error('User contacts error:', err); res.status(500).json({ error: err.message }); }
});

module.exports = router;
