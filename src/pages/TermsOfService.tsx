import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <h1 className="text-3xl font-bold mb-6">Terms of Service</h1>
        <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using BreakingBets LLC's services ("Service"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              BreakingBets LLC provides sports analytics, statistics, and informational content for entertainment and educational purposes only. We do not facilitate, encourage, or endorse gambling or betting activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Responsibilities</h2>
            <p>By using our Service, you agree to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Provide accurate and complete information when creating an account</li>
              <li>Maintain the security of your account credentials</li>
              <li>Use the Service in compliance with all applicable laws and regulations</li>
              <li>Not use the Service for any unlawful or prohibited purpose</li>
              <li>Not attempt to gain unauthorized access to any part of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Disclaimer</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. BREAKINGBETS LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. ALL INFORMATION PROVIDED IS FOR INFORMATIONAL PURPOSES ONLY AND SHOULD NOT BE CONSTRUED AS FINANCIAL OR BETTING ADVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              IN NO EVENT SHALL BREAKINGBETS LLC BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Age Requirement</h2>
            <p className="text-muted-foreground">
              You must be at least 18 years of age to use this Service. By using the Service, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Intellectual Property</h2>
            <p className="text-muted-foreground">
              All content, features, and functionality of the Service, including but not limited to text, graphics, logos, and software, are the exclusive property of BreakingBets LLC and are protected by copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
            <p className="text-muted-foreground">
              We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed and construed in accordance with the laws of the United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms of Service, please contact us at:{' '}
              <a href="mailto:breakingbet.dubs@gmail.com" className="text-primary hover:underline">
                breakingbet.dubs@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;