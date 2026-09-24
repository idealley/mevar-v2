/*
  email-tools.config.mjs: the one product the send tools know (goal 06). Data
  only: the key and the segment id are in the root .env (RESEND_API_KEY,
  RESEND_SEGMENT_ID), the same names as on the Pages project.
*/
export default {
  envKey: "RESEND_API_KEY",
  // Most readers are in West Africa (UTC+0, no daylight saving).
  timezone: "Africa/Abidjan",
  product: {
    label: "Publications",
    distDir: "email/dist",
    recordDir: "email/receipts",
    from: "MEVAR <publications@updates.mevar.org>",
    replyTo: "contact@mevar.org",
    defaultSendTime: "07:00",
  },
};
