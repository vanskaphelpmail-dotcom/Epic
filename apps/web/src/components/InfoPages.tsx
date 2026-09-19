import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, HelpCircle, ShieldCheck, FileText, ChevronDown } from 'lucide-react';
import { getPrimaryOutlet, type OutletLocation } from '../lib/outletInfo';

interface InfoPagesProps {
  pageType: string;
  onBack: () => void;
  brandName?: string;
  outlets?: OutletLocation[];
}

export const InfoPages: React.FC<InfoPagesProps> = ({ pageType, onBack, brandName, outlets }) => {
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMsg, setTicketMsg] = useState('');
  const [ticketConfirmed, setTicketConfirmed] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const primary = getPrimaryOutlet(outlets);
  const shopLabel = brandName || 'Epic Vanskap';
  const contactEmail = primary.email || 'support@epicvanskap.com';
  const contactPhone = primary.phone || '';
  const outletList = (outlets && outlets.length > 0 ? outlets : [primary]).filter(
    (o) => o.city || o.address || o.phone,
  );

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
    <section className="bg-[#0a0a0a] text-white py-12 px-6 md:px-12 max-w-4xl mx-auto min-h-screen">
      
      <button
        onClick={onBack}
        type="button"
        className="inline-flex items-center gap-2 mb-10 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white hover:border-red-600 hover:bg-zinc-800 text-sm font-black uppercase tracking-wide cursor-pointer transition-colors shadow-sm"
      >
        <span className="text-red-500" aria-hidden>
          ←
        </span>
        Go to Home
      </button>

      {/* RENDER PAGES */}
      {pageType === 'faq' && (
        <div className="space-y-8 animate-fadeIn">
          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tight">Frequently Asked Questions (FAQ)</h1>
            <p className="text-xs text-zinc-300 font-mono">Collector support database</p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 cursor-pointer hover:border-zinc-800 transition-all"
              >
                <div className="flex justify-between items-center gap-4">
                  <h4 className="text-sm font-bold text-white">{faq.q}</h4>
                  <ChevronDown
                    size={16}
                    className={`text-zinc-300 transition-transform duration-300 ${expandedFaq === idx ? 'rotate-180' : ''}`}
                  />
                </div>
                {expandedFaq === idx && (
                  <p className="mt-4 text-xs text-zinc-300 leading-relaxed border-t border-zinc-800 pt-4 animate-fadeIn">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pageType === 'about' && (
        <div className="space-y-8 animate-fadeIn leading-relaxed text-sm text-zinc-300">
          <div className="space-y-3">
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-red-500">
              Our story
            </p>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
              About Epic Vanskap
            </h1>
            <p className="text-base text-zinc-200 max-w-2xl">
              Epic Vanskap is more than a jersey shop. It is a story of friendship, dreams, passion, and the journey of five friends who decided to build something of their own.
            </p>
          </div>

          <figure className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
              <img
                src="/about-founders.jpg"
                alt="Epic Vanskap founders — Nayeem, Mishkat, Yaqub, Rajib, and Rahin"
                className="w-full h-auto object-cover object-center max-h-[min(70vh,560px)]"
                loading="eager"
              />
            </div>
            <figcaption className="text-[11px] font-mono text-zinc-500 text-center">
              Five Friends. One Dream. One Vanskap.
            </figcaption>
          </figure>

          <div className="space-y-4 text-[13px] md:text-sm leading-relaxed">
            <p>
              The name <span className="text-white font-semibold">“Vanskap”</span> comes from the Swedish word for friendship, while{' '}
              <span className="text-white font-semibold">“Epic”</span> represents the kind of friendship and memories we wanted to create — something truly unforgettable.
            </p>
            <p>
              Our journey began with six friends from Feni Government Pilot High School —{' '}
              <span className="text-white font-semibold">Nayeem, Mishkat, Yaqub, Rajib, Rahin, and Ifu</span>.
            </p>
            <p>
              We started Epic Vanskap with a simple idea: turn our friendship and passion for football into something we could build together. What started as a dream among six school friends slowly became a brand we could proudly call our own.
            </p>
            <p>
              Along the way, life took us in different directions. Due to personal reasons, Ifu had to leave the journey. Although our team became five, the dream never became smaller.
            </p>
            <p>
              Today, <span className="text-white font-semibold">Nayeem, Mishkat, Yaqub, Rajib, and Rahin</span> continue to carry the dream of Epic Vanskap forward.
            </p>
            <p>
              Building something from scratch is never easy. There are challenges, setbacks, and unexpected turns. But one thing has always remained the same — the friendship, passion, and dream that started it all.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 space-y-4">
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.2em] text-zinc-500">
              Our Motto
            </p>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
              Think Outside The Box.
            </h2>
            <p className="text-[13px] md:text-sm text-zinc-300 leading-relaxed">
              We believe in being different, challenging the ordinary, and creating our own path. For us, thinking outside the box means bringing creativity into every design, every idea, and every step of our journey.
            </p>
            <p className="text-[13px] md:text-sm text-zinc-300 leading-relaxed">
              We don&apos;t just want to sell jerseys. We want to build a brand, create memories, and inspire people to think differently.
            </p>
          </div>

          <div className="space-y-4 text-[13px] md:text-sm leading-relaxed border-t border-zinc-800 pt-8">
            <p className="text-lg md:text-xl font-black text-white tracking-tight">
              Five Friends. One Dream. One Vanskap.
            </p>
            <p>
              Epic Vanskap is a reminder that great things can begin with something as simple as friendship.
            </p>
            <p>
              Every jersey we create carries a little piece of our journey, and every customer who becomes part of Epic Vanskap becomes a part of that story too.
            </p>
            <p className="text-white font-semibold pt-2">
              Epic Vanskap — Born From Friendship, Driven By Passion, Inspired To Think Outside The Box.
            </p>
          </div>
        </div>
      )}

      {pageType === 'authenticity' && (
        <div className="space-y-6 animate-fadeIn leading-relaxed text-xs text-zinc-300">
          <div className="space-y-2 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Authenticity Guarantee</h1>
            <p className="text-xs text-zinc-300 font-mono">12-point physical verification before every listing</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-start gap-4">
            <ShieldCheck size={28} className="text-zinc-400 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-white">What we check</h4>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
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
            <p className="text-xs text-zinc-300 font-mono">Live secure helpdesk portal</p>
          </div>

          {ticketConfirmed && (
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-300 p-4 rounded-xl text-xs font-mono text-center">
              ✓ Helpdesk Ticket submitted. An authentication representative will respond inside 60 minutes.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Form */}
            <form onSubmit={handleTicketSubmit} className="md:col-span-7 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-mono font-black text-white uppercase tracking-widest border-b border-zinc-800 pb-2">
                Submit Support Ticket
              </h3>
              
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 font-mono">TICKET SUBJECT / ISSUE:</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sizing check on 1998 France shirt"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  className="w-full bg-[#121212] border border-zinc-800 rounded-lg py-2.5 px-3 text-xs text-white focus:outline-none focus:border-red-600"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 font-mono">DETAILED DESCRIPTION:</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide context or tracking IDs..."
                  value={ticketMsg}
                  onChange={(e) => setTicketMsg(e.target.value)}
                  className="w-full bg-[#121212] border border-zinc-800 rounded-lg py-2.5 px-3 text-xs text-white focus:outline-none focus:border-red-600"
                />
              </div>

              <button
                type="submit"
                className="bg-black hover:bg-zinc-700 text-white font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer w-full"
              >
                Submit Ticket <Send size={13} />
              </button>
            </form>

            {/* Quick Contact Info — from Admin → Physical Outlet Cards */}
            <div className="md:col-span-5 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 text-xs text-zinc-300">
              <h3 className="text-xs font-mono font-black text-white uppercase tracking-widest border-b border-zinc-800 pb-2">
                Helpdesk Coordinates
              </h3>
              
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-zinc-400" />
                <span>{contactEmail}</span>
              </div>
              {contactPhone ? (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-zinc-400" />
                  <span>{contactPhone}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-zinc-400" />
                  <span>Visit our {primary.city || shopLabel} shop for in-person help</span>
                </div>
              )}
              {outletList.map((loc, idx) => (
                <div key={`${loc.city}-${idx}`} className="flex items-start gap-3">
                  <MapPin size={16} className="text-zinc-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold text-white block">{loc.city || shopLabel}</span>
                    {loc.address ? <span className="block">{loc.address}</span> : null}
                    {loc.phone ? <span className="block font-mono text-zinc-400">{loc.phone}</span> : null}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Policy templates */}
      {(pageType === 'privacy' || pageType === 'refund' || pageType === 'terms' || pageType === 'shipping') && (
        <div className="space-y-6 animate-fadeIn leading-relaxed text-xs text-zinc-300">
          <div className="space-y-2 border-b border-zinc-800 pb-4 mb-6">
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">
              {pageType === 'privacy' && 'Privacy & Secure Data Encryption Policy'}
              {pageType === 'refund' && 'Returns & Refunds Sourced Policy'}
              {pageType === 'terms' && 'Terms of Service & Collectible Licensing'}
              {pageType === 'shipping' && 'Global Sourced Shipping Rates & Taxes'}
            </h1>
            <p className="text-xs text-zinc-300 font-mono">Secured Legal Compliance Statement</p>
          </div>

          <p>
            Epic Vanskap is strictly dedicated to safeguarding data privacy, secure SSL token transactions, and legal consumer transparency.
          </p>
          <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 text-[11px] space-y-2 font-mono">
            <p className="text-white font-bold">[SECTION A: SOURCE TRANSPAREIVITY]</p>
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
