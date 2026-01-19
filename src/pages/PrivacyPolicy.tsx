import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy = () => {
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

        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <div className="space-y-6 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p>BreakingBets LLC ("we," "our," or "us") collects information you provide directly to us, including:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Account information (email address, username)</li>
              <li>Usage data and preferences</li>
              <li>Device and browser information</li>
              <li>IP address and location data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send technical notices, updates, and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Analyze usage patterns and trends</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy or as required by law. We may share information with service providers who assist in our operations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground">
              We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or indicate when a cookie is being sent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
              <li>Access and receive a copy of your personal data</li>
              <li>Rectify or update your personal information</li>
              <li>Request deletion of your personal data</li>
              <li>Object to processing of your personal data</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Children's Privacy</h2>
            <p className="text-muted-foreground">
              Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you become aware that a child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact Us</h2>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at:{' '}
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

export default PrivacyPolicy;