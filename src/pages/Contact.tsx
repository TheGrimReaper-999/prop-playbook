import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Mail } from 'lucide-react';
import breakingBetsLogo from '@/assets/breaking-bets-logo.png';

const Contact = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="text-center mb-8">
          <img 
            src={breakingBetsLogo} 
            alt="BreakingBets LLC Logo" 
            className="w-48 h-48 mx-auto mb-6 rounded-2xl shadow-lg"
          />
          <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
          <p className="text-muted-foreground">Get in touch with BreakingBets LLC</p>
        </div>

        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">BreakingBets LLC</h2>
                <p className="text-muted-foreground mb-6">
                  Have questions, feedback, or just want to say hello? We'd love to hear from you!
                </p>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3 text-lg">
                  <Mail className="w-6 h-6 text-primary" />
                  <a 
                    href="mailto:breakingbet.dubs@gmail.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    breakingbet.dubs@gmail.com
                  </a>
                </div>
              </div>

              <div className="pt-6 border-t border-border/30">
                <p className="text-sm text-muted-foreground">
                  We typically respond within 24-48 hours during business days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} BreakingBets LLC. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Contact;