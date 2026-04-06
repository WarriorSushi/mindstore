import type { Metadata } from "next";
import Link from "next/link";
import { MindStoreLogo } from "@/components/MindStoreLogo";

export const metadata: Metadata = {
  title: "Terms of Service — MindStore",
  description: "Terms and conditions governing your use of MindStore.",
};

const EFFECTIVE_DATE = "April 6, 2025";
const CONTACT_EMAIL = "legal@mindstore.org";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-[18px] font-bold text-zinc-100 mb-4 mt-10">{title}</h2>
      <div className="space-y-4 text-[15px] text-zinc-400 leading-relaxed">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100">
      {/* Nav */}
      <header className="border-b border-white/[0.06] sticky top-0 z-50 bg-[#0a0a0b]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <MindStoreLogo className="w-7 h-7" />
            <span className="text-[15px] font-semibold text-zinc-100">MindStore</span>
          </Link>
          <Link href="/privacy" className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[12px] font-semibold text-teal-400 uppercase tracking-[0.08em] mb-5">
            Legal
          </div>
          <h1 className="text-[36px] font-bold text-zinc-100 tracking-tight mb-3">Terms of Service</h1>
          <p className="text-[15px] text-zinc-500">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Last updated: {EFFECTIVE_DATE}
          </p>
        </div>

        <div className="prose-none">
          <p className="text-[15px] text-zinc-400 leading-relaxed border-l-2 border-teal-500/40 pl-4 mb-8">
            These Terms of Service ("<strong className="text-zinc-300">Terms</strong>") form a legally binding agreement between you ("<strong className="text-zinc-300">you</strong>", "<strong className="text-zinc-300">User</strong>") and MindStore ("<strong className="text-zinc-300">we</strong>", "<strong className="text-zinc-300">us</strong>", "<strong className="text-zinc-300">our</strong>") governing your access to and use of the MindStore platform at{" "}
            <a href="https://mindstore.org" className="text-teal-400 hover:text-teal-300">mindstore.org</a>{" "}
            and all related services (the "<strong className="text-zinc-300">Service</strong>"). <strong className="text-zinc-300">By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</strong>
          </p>

          <Section id="eligibility" title="1. Eligibility & Account">
            <p>You must be at least 13 years old (16 in the EEA) to use the Service. By using the Service, you represent that you meet this requirement.</p>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a> if you suspect unauthorized access.</p>
            <p>We reserve the right to suspend or terminate accounts that violate these Terms, at our sole discretion, with or without notice.</p>
          </Section>

          <Section id="license" title="2. License to Use the Service">
            <p>Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial purposes.</p>
            <p>You may not: (a) sublicense, sell, resell, or commercially exploit the Service; (b) reverse engineer, decompile, or disassemble any part of the Service except as permitted by law; (c) use the Service to build a competing product; (d) access the Service by automated means (scraping, bots) without our written permission; (e) use the Service in any manner that could damage, disable, or impair our infrastructure.</p>
          </Section>

          <Section id="your-content" title="3. Your Content">
            <p>You retain all ownership rights to content you upload, import, or create within the Service ("<strong className="text-zinc-300">Your Content</strong>").</p>
            <p>By using the Service, you grant us a worldwide, royalty-free, non-exclusive license to host, store, copy, process, and display Your Content solely to provide and improve the Service for you. This license terminates when you delete Your Content or your account.</p>
            <p>You represent and warrant that: (a) you own or have the necessary rights to Your Content; (b) Your Content does not infringe, misappropriate, or violate any third-party intellectual property, privacy, or other rights; (c) Your Content does not violate applicable law.</p>
            <p>We do not claim ownership of Your Content and will not use it to train AI models.</p>
          </Section>

          <Section id="prohibited" title="4. Prohibited Conduct">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Upload, transmit, or store content that is unlawful, abusive, defamatory, obscene, or otherwise objectionable</li>
              <li>Infringe any intellectual property, privacy, or proprietary rights of any party</li>
              <li>Harass, threaten, or harm any individual</li>
              <li>Distribute malware, viruses, or any malicious code</li>
              <li>Attempt to gain unauthorized access to any system, network, or account</li>
              <li>Engage in any activity that constitutes illegal conduct under applicable law</li>
              <li>Circumvent any security measure, rate limit, or access control</li>
              <li>Impersonate any person or entity</li>
            </ul>
            <p>We reserve the right to remove content or suspend accounts in violation of this section without prior notice.</p>
          </Section>

          <Section id="third-party" title="5. Third-Party Services & AI Providers">
            <p>The Service integrates with third-party AI providers (e.g. Google Gemini, OpenAI, OpenRouter). Your use of these providers through the Service is subject to their respective terms and privacy policies. We are not responsible for the accuracy, availability, or conduct of third-party providers.</p>
            <p>By configuring a third-party API key, you authorize us to transmit your content to that provider on your behalf to fulfil AI features. You are responsible for complying with the terms of any third-party service you connect.</p>
          </Section>

          <Section id="payment" title="6. Paid Plans & Billing">
            <p>Certain features require a paid subscription ("<strong className="text-zinc-300">Pro Plan</strong>"). All fees are stated at checkout and are exclusive of applicable taxes unless otherwise noted.</p>
            <p>Payments are processed by our payment provider. We do not store your full payment card details.</p>
            <p>Subscriptions automatically renew unless cancelled before the renewal date. Refunds are handled on a case-by-case basis — contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a> within 7 days of a charge for consideration.</p>
            <p>We reserve the right to change pricing with 30 days' notice. Continued use after a price change constitutes acceptance of the new price.</p>
          </Section>

          <Section id="intellectual-property" title="7. Intellectual Property">
            <p>The Service, its design, code, trademarks, logos, and all content created by us (excluding Your Content) are owned by MindStore and protected by intellectual property laws worldwide.</p>
            <p>Nothing in these Terms transfers any intellectual property rights to you except the limited license granted in Section 2.</p>
          </Section>

          <Section id="dmca" title="8. Copyright & DMCA">
            <p>We respect intellectual property rights. If you believe content on the Service infringes your copyright, send a notice to <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a> with: (a) identification of the copyrighted work; (b) identification of the infringing material and its location; (c) your contact information; (d) a statement of good faith belief that the use is unauthorized; (e) a statement under penalty of perjury that the information is accurate and you are authorized to act on behalf of the copyright owner.</p>
          </Section>

          <Section id="disclaimer" title="9. Disclaimer of Warranties">
            <p className="uppercase text-[13px] font-semibold text-zinc-300">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED/ERROR-FREE OPERATION.
            </p>
            <p>We do not warrant that: (a) the Service will be secure, error-free, or available at any particular time; (b) any AI-generated content is accurate, complete, or reliable; (c) the Service will meet your specific requirements.</p>
            <p>AI-generated outputs are for informational purposes only. They do not constitute professional advice (legal, medical, financial, or otherwise). Do not rely on AI outputs for critical decisions without independent verification.</p>
          </Section>

          <Section id="limitation" title="10. Limitation of Liability">
            <p className="uppercase text-[13px] font-semibold text-zinc-300">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MINDSTORE, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) USD $100.</p>
            <p>Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so the above limitations may not apply to you in full.</p>
          </Section>

          <Section id="indemnification" title="11. Indemnification">
            <p>You agree to defend, indemnify, and hold harmless MindStore and its officers, directors, employees, contractors, agents, licensors, and successors from and against any claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or in connection with: (a) your use of the Service; (b) Your Content; (c) your violation of these Terms; (d) your violation of any third-party rights; or (e) your violation of applicable law.</p>
          </Section>

          <Section id="termination" title="12. Termination">
            <p>You may terminate your account at any time by deleting it from the Settings page or by contacting us. Upon termination, your right to use the Service ceases immediately.</p>
            <p>We may suspend or terminate your access at any time, with or without cause, with or without notice. Termination does not entitle you to a refund unless required by applicable law.</p>
            <p>Sections 3, 7, 9, 10, 11, 13, and 14 survive termination.</p>
          </Section>

          <Section id="governing-law" title="13. Governing Law & Dispute Resolution">
            <p>These Terms are governed by applicable law. Any dispute arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to binding arbitration or the courts of competent jurisdiction.</p>
            <p>You waive any right to participate in a class action lawsuit or class-wide arbitration against MindStore.</p>
          </Section>

          <Section id="general" title="14. General Provisions">
            <p><strong className="text-zinc-300">Entire Agreement:</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and MindStore regarding the Service and supersede all prior agreements.</p>
            <p><strong className="text-zinc-300">Severability:</strong> If any provision is found unenforceable, the remaining provisions remain in full force.</p>
            <p><strong className="text-zinc-300">No Waiver:</strong> Failure to enforce any right or provision does not constitute a waiver of that right.</p>
            <p><strong className="text-zinc-300">Assignment:</strong> You may not assign these Terms without our written consent. We may assign them freely.</p>
            <p><strong className="text-zinc-300">Updates:</strong> We may modify these Terms at any time. Material changes will be communicated via email or in-app notice at least 14 days before taking effect. Continued use constitutes acceptance.</p>
          </Section>

          <Section id="contact" title="15. Contact">
            <p>
              For questions about these Terms:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-teal-400 hover:text-teal-300">{CONTACT_EMAIL}</a>
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-zinc-600">
          <span>© {new Date().getFullYear()} MindStore. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-teal-500">Terms of Service</Link>
            <Link href="/" className="hover:text-zinc-400 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
