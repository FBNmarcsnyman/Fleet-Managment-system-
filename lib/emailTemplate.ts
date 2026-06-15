// Shared branded wrapper for all outbound FBN emails — logo header,
// "Control Centre" + "Commercial Freight Specialists" tagline, navy/yellow
// banner and a footer. Pass the inner content HTML; get a full email back.
const NAVY = '#13294b';
const YELLOW = '#f5b700';
const GREY = '#5b6573';

export const brandedEmail = (content: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fbn-transport.co.za';
    return `<div style="background:#eef2f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#ffffff;padding:18px 24px;border-bottom:3px solid ${NAVY}">
      <img src="${origin}/fbn-logo.jpg" alt="FBN Transport" height="46" style="height:46px;display:block" />
      <div style="color:${NAVY};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-top:7px">Control Centre</div>
      <div style="color:${GREY};font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Commercial Freight Specialists</div>
    </div>
    <div style="height:4px;background:${YELLOW}"></div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.5">${content}</div>
    <div style="padding:14px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#94a3b8;font-size:11px;text-align:center">
      FBN Transport &middot; Commercial Freight Specialists &middot; tracking@fbn-transport.co.za
    </div>
  </div>
</div>`;
};

// A reusable navy call-to-action button for email bodies.
export const emailButton = (href: string, label: string, color = NAVY): string =>
    `<p style="text-align:center;margin:22px 0"><a href="${href}" style="background:${color};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px;display:inline-block">${label}</a></p>`;
