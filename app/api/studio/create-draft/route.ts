import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { subject, html } = await req.json() as { subject: string; html: string };

  if (!subject || !html) {
    return NextResponse.json({ error: "subject and html are required" }, { status: 400 });
  }

  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!audienceId) {
    return NextResponse.json({ error: "MAILCHIMP_AUDIENCE_ID not configured" }, { status: 500 });
  }

  const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
  mc.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY!,
    server: process.env.MAILCHIMP_SERVER_PREFIX!,
  });

  // Create campaign as draft (status "save" is automatic on creation)
  const campaign = await mc.campaigns.create({
    type: "regular",
    recipients: { list_id: audienceId },
    settings: {
      subject_line: subject,
      preview_text:  subject,
      from_name:     process.env.MAILCHIMP_FROM_NAME  ?? "Hebe Haven Yacht Club",
      reply_to:      process.env.MAILCHIMP_REPLY_TO   ?? "",
      auto_footer:   false,
    },
  }) as any;

  const campaignId: string = campaign.id;
  const webId: number      = campaign.web_id;

  // Set the generated HTML as campaign content
  await mc.campaigns.setContent(campaignId, { html });

  const dc  = process.env.MAILCHIMP_SERVER_PREFIX ?? "us1";
  const url = `https://${dc}.admin.mailchimp.com/campaigns/edit?id=${webId}`;

  return NextResponse.json({ campaignId, url });
}
