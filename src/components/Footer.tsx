import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="text-center py-6 text-muted-foreground text-sm space-y-2 border-t border-border/30 mt-auto">
      <div className="flex justify-center gap-4 flex-wrap">
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        <span className="hidden sm:inline">•</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        <span className="hidden sm:inline">•</span>
        <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
      </div>
      <p>© {new Date().getFullYear()} BreakingBets LLC. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
