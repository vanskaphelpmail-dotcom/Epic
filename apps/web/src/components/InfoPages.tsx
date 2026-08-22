import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, HelpCircle, ShieldCheck, FileText, ChevronDown } from 'lucide-react';

interface InfoPagesProps {
  pageType: string;
  onBack: () => void;
}

export const InfoPages: React.FC<InfoPagesProps> = ({ pageType, onBack }) => {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketConfirmed, setTicketConfirmed] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketSubject.trim() && ticketMsg.trim()) {
      setTicketConfirmed(true);
      setTicketSubject('');
      setTicketMsg('');
    }
  };

  const FAQS = [
    {
      q: "How do I know the football shirts are 100% genuine original vintage jerseys?",
      a: "Every single shirt we receive undergoes a strict 12-point physical verification audit. We inspect manufacturer product codes, neck tags, wash care labels, fabric weaves, crest stitching, sponsor materials, and sleeve patches against our extensive global physical archives. We never source or stock modern replica remakes."
    },
    {
      q: "Can I customized jerseys with any nameset and squad number?",
      a: "Yes! If a product is marked as Print Available, you can add any customized last name and number up to 99. We use genuine flock or vinyl namesets that match the exact vintage typography used by the team in that specific historical season."
    },
    {
      q: "What is your return policy if the jersey doesn't fit?",
      a: "Since vintage shirts are unique, we offer a 14-day return window from delivery. Please note that customized printed shirts with specific user names or numbers cannot be returned unless they are found to have a defect in materials."
    },
    {
      q: "How long does secure shipping take?",
      a: "Standard Sourced shipping takes 4 to 7 business days globally. Expedited flight shipping reaches your door in 2 to 3 business days. All packages are insured and vacuum-sealed inside custom collector protection sleeves."
    }
  ];

  return (
    <section className="bg-[#fcfdfc] text-zinc-950 py-12 px-6 md:px-12 max-w-4xl mx-auto min-h-screen">
      
      {/* Return Catalog Link */}
      <button
        onClick={onBack}
        className="text-xs font-mono font-bold text-zinc-800 hover:text-black uppercase tracking-widest mb-10 cursor-pointer"
      >
        ← Back to Catalog
      </button>

      {/* RENDER PAGES */}
      {pageType === 'faq' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight">Frequently Asked Questions (FAQ)</h1>
            <p className="text-xs text-zinc-800 font-mono">Collector support database</p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="bg-zinc-50 border border-zinc-100 rounded-2xl p-5 cursor-pointer hover:border-zinc-200 transition-all"
              >
                <div className="flex justify-between items-center gap-4">
                  <h4 className="text-sm font-bold text-zinc-950">{faq.q}</h4>
                  <ChevronDown
                    size={16}
                    className={`text-zinc-800 transition-transform duration-300 ${expandedFaq === idx ? 'rotate-180' : ''}`}
                  />
                </div>
                {expandedFaq === idx && (
                  <p className="mt-4 text-xs text-zinc-800 leading-relaxed border-t border-zinc-100 pt-4 animate-fadeIn">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pageType === 'about' && (
        <div className="space-y-6 animate-fadeIn leading-relaxed text-xs text-zinc-800">
          <div className="space-y-2 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-950">The Sourcing & Authentication Story</h1>
            <p className="text-xs text-zinc-800 font-mono">Preserving footballing heritage</p>
          </div>

          <p>
            Epic Vanskap BD was founded in 2026 by a collective of passionate historians, football culture enthusiasts, and obsessive kit archivists. We grew tired of modern low-quality replica remakes flooded across the internet and set out to preserve authentic jersey design.
          </p>
          <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-2xl my-6 flex items-start gap-4">
            <ShieldCheck size={28} className="text-zinc-700 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-zinc-950">Our 12-Point Authentication Matrix</h4>
              <p className="text-zinc-700 leading-normal">
                Every thread, button stitch, neck labels, brand logo watermark, sleeve cuffs, and material blend ratio is physical cross-referenced against our original database archive. We issue a physical, serialized certificate of authentication with every single item shipped.
              </p>
            </div>
          </div>
          <p>
            Operating physical verification laboratories in Dhaka, London, and Manchester, we work closely with retired players, club kit men, and global suppliers to procure genuine museum-grade jerseys from the 1970s, 80s, 90s, and 2000s. Secure footballing legacy at Epic Vanskap BD.
          </p>
        </div>
      )}

      {pageType === 'authenticity' && (
        <div className="space-y-6 animate-fadeIn leading-relaxed text-xs text-zinc-800">
          <div className="space-y-2 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-950">Authenticity Guarantee</h1>
            <p className="text-xs text-zinc-800 font-mono">12-point physical verification before every listing</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 p-6 rounded-2xl flex items-start gap-4">
            <ShieldCheck size={28} className="text-zinc-700 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-zinc-950">What we check</h4>
              <ul className="list-disc pl-4 space-y-1 text-zinc-700">
                <li>Manufacturer product codes and neck / wash labels</li>
                <li>Crest embroidery, sponsor print, and sleeve patches</li>
                <li>Fabric weave, collar construction, and fit silhouette</li>
                <li>Season-correct nameset typography when printing is available</li>
              </ul>
            </div>
          </div>
          <p>
            Every jersey ships with a serialized certificate of authentication. If you ever receive an item that fails our authenticity standard, contact the helpdesk for a full resolution.
          </p>
        </div>
      )}

      {pageType === 'contact' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight">Contact Sourcing Customer Desk</h1>
            <p className="text-xs text-zinc-800 font-mono">Live secure helpdesk portal</p>
          </div>

          {ticketConfirmed && (
            <div className="bg-zinc-50 border border-zinc-200 text-zinc-800 p-4 rounded-xl text-xs font-mono text-center">
              ✓ Helpdesk Ticket submitted. An authentication representative will respond inside 60 minutes.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Form */}
            <form onSubmit={handleTicketSubmit} className="md:col-span-7 bg-zinc-50 border border-zinc-100 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-black text-zinc-950 uppercase tracking-widest border-b border-zinc-100 pb-2">
                Submit Support Ticket
              </h3>
              
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-700 font-mono">TICKET SUBJECT / ISSUE:</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sizing check on 1998 France shirt"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-white border border-zinc-100 rounded-lg py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-700 font-mono">DETAILED DESCRIPTION:</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide context or tracking IDs..."
                  value={ticketMsg}
                  onChange={(e) => setTicketMsg(e.target.value)}
                  className="w-full bg-white border border-zinc-100 rounded-lg py-2.5 px-3 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <button
                type="submit"
                className="bg-black hover:bg-zinc-700 text-white font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer w-full"
              >
                Submit Ticket <Send size={13} />
              </button>
            </form>

            {/* Quick Contact Info */}
            <div className="md:col-span-5 bg-zinc-50 border border-zinc-100 p-6 rounded-2xl space-y-4 text-xs text-zinc-800">
              <h3 className="text-xs font-mono font-black text-zinc-950 uppercase tracking-widest border-b border-zinc-100 pb-2">
                Helpdesk Coordinates
              </h3>
              
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-zinc-700" />
                <span>admin@epicvanskap.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-zinc-700" />
                <span>Visit our Feni shop for in-person help</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-zinc-700 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-zinc-950 block">Feni Garden City Market</span>
                  <span>Shop no: B: 67-68, 1st Floor, Feni Garden City Market, Feni, 3900</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Policy templates */}
      {(pageType === 'privacy' || pageType === 'refund' || pageType === 'terms' || pageType === 'shipping') && (
        <div className="space-y-6 animate-fadeIn leading-relaxed text-xs text-zinc-800">
          <div className="space-y-2 border-b border-zinc-100 pb-4 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-zinc-950">
              {pageType === 'privacy' && 'Privacy & Secure Data Encryption Policy'}
              {pageType === 'refund' && 'Returns & Refunds Sourced Policy'}
              {pageType === 'terms' && 'Terms of Service & Collectible Licensing'}
              {pageType === 'shipping' && 'Global Sourced Shipping Rates & Taxes'}
            </h1>
            <p className="text-xs text-zinc-800 font-mono">Secured Legal Compliance Statement</p>
          </div>

          <p>
            Epic Vanskap BD is strictly dedicated to safeguarding data privacy, secure SSL token transactions, and legal consumer transparency.
          </p>
          <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-100 text-[11px] space-y-2 font-mono">
            <p className="text-zinc-950 font-bold">[SECTION A: SOURCE TRANSPAREIVITY]</p>
            <p>1. All products cataloged represent unique curated items. Batch serial keys are registered globally.</p>
            <p>2. Credit card credentials entered on our secure forms bypass client logs and transfer directly to 256-bit encrypted gateways (Stripe/PayPal/SSLCommerz).</p>
          </div>
          <p>
            If you require explicit certification copy of origin for custom corporate collections or museum displays, please route a formal ticket request to the helpdesk.
          </p>
        </div>
      )}

    </section>
  );
};
