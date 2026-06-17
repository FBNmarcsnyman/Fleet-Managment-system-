// Shared branded wrapper for all outbound FBN emails. Modern, fresh look:
// navy header with the logo on a white chip, a crisp yellow accent, generous
// spacing and a tidy footer. Pass the inner content HTML; get a full email back.
const NAVY = '#13294b';
const YELLOW = '#f5b700';
const GREY = '#64748b';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const brandedEmail = (content: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fbn-transport.co.za';
    return `<div style="background:#eef2f6;padding:32px 14px;font-family:${FONT};-webkit-font-smoothing:antialiased">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.10);border:1px solid #e6ebf1">
    <!-- Header -->
    <div style="background:${NAVY};background-image:linear-gradient(135deg,#13294b 0%,#1d3a66 100%);padding:26px 30px">
      <div style="background:#ffffff;border-radius:10px;display:inline-block;padding:8px 12px">
        <img src="${origin}/fbn-logo.jpg" alt="FBN Transport" height="40" style="height:40px;display:block" />
      </div>
      <div style="color:${YELLOW};font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-top:14px">Control Centre</div>
      <div style="color:#aebfd4;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:3px">Commercial Freight Specialists</div>
    </div>
    <div style="height:4px;background:${YELLOW}"></div>
    <!-- Body -->
    <div style="padding:30px 30px 26px;color:#334155;font-size:15px;line-height:1.65">${content}</div>
    <!-- Footer -->
    <div style="padding:18px 30px;border-top:1px solid #eef2f6;background:#f8fafc;color:${GREY};font-size:12px;line-height:1.6;text-align:center">
      <div style="font-weight:700;color:${NAVY}">FBN Transport</div>
      <div style="color:#94a3b8">Commercial Freight Specialists</div>
      <div style="margin-top:6px">
        <a href="mailto:tracking@fbn-transport.co.za" style="color:${GREY};text-decoration:none">tracking@fbn-transport.co.za</a>
        &nbsp;&middot;&nbsp;
        <a href="https://fbn-transport.co.za" style="color:${GREY};text-decoration:none">fbn-transport.co.za</a>
      </div>
    </div>
  </div>
  <div style="max-width:600px;margin:12px auto 0;text-align:center;color:#94a3b8;font-size:11px;font-family:${FONT}">This is an automated message from the FBN Control Centre.</div>
</div>`;
};

// A reusable, modern call-to-action button for email bodies.
export const emailButton = (href: string, label: string, color = NAVY): string =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto"><tr><td style="border-radius:10px;background:${color}">
      <a href="${href}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.3px;border-radius:10px">${label}</a>
    </td></tr></table>`;
