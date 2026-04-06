import type { Metadata } from "next";
import Link from "next/link";
import { MindStoreLogo } from "@/components/MindStoreLogo";

export const metadata: Metadata = {
  title: "Privacy Policy — MindStore",
  description: "How MindStore collects, uses, and protects your personal data.",
};

const EFFECTIVE_DATE = "April 6, 2025";
const CONTACT_EMAIL = "privacy@mindstore.org";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-[18px] font-bold text-zinc-100 mb-4 mt-10">{title}</h2>
      <div className="space-y-4 text-[15px] text-zinc-400 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Nav */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-[#0a0a0b]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MindStoreLogo className="w-7 h-7" />
            <span className="text-[15px] font-semibold text-zinc-100">MindStore</span>
          </Link>
          <Link href="/terms" className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
            Terms of Service →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[12px] font-semibold text-teal-400 uppercase tracking-[0.08em] mb-5">
            Legal
          </div>
          <h1 className="text-[36px] font-bold text-zinc-100 tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-[15px] text-zinc-500">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="prose-none">
          <p className="text-[15px] text-zinc-400 leading-relaxed border-l-2 border-teal-500/40 pl-4 mb-8">
            MindStore ("<strong className="text-zinc-300">we</strong>", "<strong className="text-zinc-300">us</strong>", "<strong className="text-zinc-300">our</strong>") operates the MindStore platform available at{" "}
            <a href="https://mindstore.org" className="text-teal-400 hover:text-teal-300">mindstore.org</a>{" "}
            and related services (collectively, the "<strong className="text-zinc-300">Service</strong>"). This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data.
            By using the Service, you agree to the practices described in this policy.
          </p>

          <Section id="information-we-collect" title="1. Information We Collect">
            <p><strong className="text-zinc-300">Account information:</strong> When you sign in with Google OAuth, we receive your name, email address, and profile picture from Google. We store this to create and manage your account.</p>
            <p><strong className="text-zinc-300">User-generated content:</strong> All memories, notes, imported documents, chat histories, flashcards, and any other content you add to MindStore ("<strong className="text-zinc-300">Your Content</strong>") is stored on our servers to provide the Service.</p>
            <p><strong className="text-zinc-300">Usage data:</strong> We collect anonymized, aggregated analytics (page views, feature usage, session counts) via Plausible Analytics. Plausible does not use cookies, does not track individuals across sites, and is GDPR-compliant by design.</p>
            <p><strong className="text-zinc-300">API keys:</strong> If you provide third-party API keys (OpenAI, Gemini, etc.) via the Settings page, they are encrypted at rest using AES-256 before storage. We do not transmit your API keys to any party other than the designated AI provider.</p>
            <p><strong className="text-zinc-300">Technical data:</strong> Server logs may capture IP addresses, browser user-agent strings, and request timestamps for security, debugging, and abuse prevention. These are retained for up to 30 days.</p>
          </Section>

          <Section id="how-we-use" title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Provide, operate, and improve the Service</li>
              <li>Authenticate your identity and maintain your session</li>
              <li>Process and store Your Content for retrieval and AI features</li>
              <li>Send transactional communications (e.g. password resets, billing receipts) — no marketing emails without explicit consent</li>
              <li>Detect, investigate, and prevent fraudulent, unauthorized, or illegal activity</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>We do <strong className="text-zinc-300">not</strong> sell your personal data. We do <strong className="text-zinc-300">not</strong> use your stored memories or content to train AI models. We do <strong className="text-zinc-300">not</strong> share your data with advertisers.</p>
          </Section>

          <Section id="your-content" title="3. Your Content — Ownership & Processing">
            <p>You retain full ownership of Your Content. We claim no intellectual property rights over it.</p>
            <p>To provide AI features (chat, semantic search, embeddings), your content is sent to third-party AI providers you configure (e.g. Google Gemini, OpenAI). This transmission is governed by the provider's own privacy policy. We transmit only the minimum content necessary to fulfil the request.</p>
            <p>If you use MindStore's default AI provider configuration, content may be processed by Google Gemini APIs. See <a href="https://policies.google.com/privacy" className="text-teal-400 hover:text-teal-300" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>.</p>
            <p>You can delete Your Content at any time from within the Service. Upon deletion, content is removed from our primary database. Backups are purged on a rolling 30-day cycle.</p>
          </Section>

          <Section id="data-sharing" title="4. Data Sharing & Third Parties">
            <p>We share data only in these limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-zinc-300">Infrastructure providers:</strong> Vercel (hosting), Supabase (database), and other processors who are contractually bound to handle data securely and only for purposes we specify.</li>
              <li><strong className="text-zinc-300">AI providers:</strong> Only the content you explicitly direct through AI features, to providers you configure.</li>
              <li><strong className="text-zinc-300">Legal requirements:</strong> If required by law, court order, or to protect the rights, safety, and property of MindStore, our users, or the public.</li>
              <li><strong className="text-zinc-300">Business transfers:</strong> In connection with a merger, acquisition, or sale of assets, with prior notice to you.</li>
            </ul>
          </Section>

          <Section id="data-security" title="5. Data Security">
            <p>We use industry-standard safeguards including TLS encryption in transit, AES-256 encryption for sensitive fields at rest, and database access controls with least-privilege principles.</p>
            <p>No method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. You are responsible for maintaining the confidentiality of your account credentials.</p>
            <p>In the event of a data breach that materially affects you, we will notify you by email within 72 hours of becoming aware, to the extent required by applicable law.</p>
          </Section>

          <Section id="cookies" title="6. Cookies & Tracking">
            <p>We use a single session cookie for authentication (HttpOnly, Secure, SameSite=Lax). No advertising cookies. No cross-site tracking. No third-party analytics cookies.</p>
            <p>Plausible Analytics is cookieless and does not fingerprint individual users.</p>
          </Section>

          <Section id="your-rights" title="7. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-zinc-300">Access:</strong> Request a copy of personal data we hold about you.</li>
              <li><strong className="text-zinc-300">Rectification:</strong> Correct inaccurate personal data.</li>
              <li><strong className="text-zinc-300">Erasure:</strong> Request deletion of your account and all associated data.</li>
              <li><strong className="text-zinc-300">Portability:</strong> Export Your Content in a machine-readable format (available via the Export feature in the app).</li>
              <li><strong className="text-zinc-300">Objection / Restriction:</strong> Object to or restrict certain processing.</li>
              <li><strong className="text-zinc-300">Withdraw consent:</strong> Where processing is based on consent, withdraw it at any time.</li>
            </ul>
            <p>To exercise these rights, email <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a>. We respond within 30 days.</p>
          </Section>

          <Section id="data-retention" title="8. Data Retention">
            <p>We retain your account data and content for as long as your account is active. If you delete your account, we remove your personal data from active systems within 30 days and from backups within 90 days.</p>
            <p>We may retain anonymized, aggregated analytics data indefinitely as it cannot identify you.</p>
          </Section>

          <Section id="children" title="9. Children's Privacy">
            <p>The Service is not directed to children under 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, contact us immediately and we will delete it.</p>
          </Section>

          <Section id="international" title="10. International Transfers">
            <p>MindStore operates globally. Your data may be transferred to and processed in countries other than your own, including the United States. We ensure appropriate safeguards (Standard Contractual Clauses or equivalent) are in place for any cross-border transfers required by applicable law.</p>
          </Section>

          <Section id="changes" title="11. Changes to This Policy">
            <p>We may update this Privacy Policy. For material changes, we will notify you by email or a prominent notice in the app at least 14 days before the change takes effect. Your continued use of the Service after the effective date constitutes acceptance of the revised policy.</p>
          </Section>

          <Section id="contact" title="12. Contact Us">
            <p>For privacy questions, data requests, or complaints:</p>
            <p>
              <strong className="text-zinc-300">Email:</strong>{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a>
            </p>
            <p className="text-[13px] text-zinc-600">
              If you are located in the EEA and believe we have not adequately addressed your concern, you have the right to lodge a complaint with your local data protection authority.
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-600">
          <span>© {new Date().getFullYear()} MindStore. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-teal-500">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
