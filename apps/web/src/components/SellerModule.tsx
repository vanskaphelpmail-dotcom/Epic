import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Upload, HelpCircle, DollarSign, Award, CheckCircle } from 'lucide-react';
import { SellerRequest } from '../types';

interface SellerModuleProps {
  onAddRequest: (req: SellerRequest) => void;
}

export const SellerModule: React.FC<SellerModuleProps> = ({ onAddRequest }) => {
  // Form State
  const [shirtName, setShirtName] = useState('');
  const [brand, setBrand] = useState('Adidas');
  const [season, setSeason] = useState('');
  const [condition, setCondition] = useState('Excellent');
  const [expectedPrice, setExpectedPrice] = useState<number | ''>('');
  
  // Drag & drop file upload mock state
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submittedConfirm, setSubmittedConfirm] = useState(false);

  const handleFileUploadMock = () => {
    // Simulate image uploading
    setUploadedFiles((prev) => [
      ...prev,
      `jersey_upload_side_${prev.length + 1}.jpg`
    ]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUploadMock();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shirtName || !season || !expectedPrice) {
      alert('Please fill out all product parameters before submitting.');
      return;
    }

    const newRequest: SellerRequest = {
      id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      shirtName,
      brand,
      season,
      condition,
      expectedPrice: Number(expectedPrice) || 100,
      images: uploadedFiles.length > 0 ? uploadedFiles : ['simulated_upload_default.jpg'],
      status: 'Pending',
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };

    onAddRequest(newRequest);
    setSubmittedConfirm(true);
    
    // Reset form
    setShirtName('');
    setSeason('');
    setExpectedPrice('');
    setUploadedFiles([]);
  };

  return (
    <section className="bg-[#fcfdfc] text-emerald-950 py-10 px-4 md:px-12 max-w-5xl mx-auto min-h-screen space-y-10 animate-fadeIn">
      
      {/* Valuation and Sourcing Explainer */}
      <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-6 right-6 text-emerald-600"><Award size={48} className="animate-pulse" /></div>
        
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-emerald-800 text-white font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded border border-emerald-700">
            <Sparkles size={12} /> SECURE SELLER MODULE
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Sell Your Football Jerseys</h1>
          <p className="text-emerald-800 text-sm leading-relaxed">
            Have rare original vintage jerseys resting in your wardrobe? Cash out instantly with our secure collector program. Submit your jersey details and images. Our curators will check physical batch numbers and offer cash or immediate vault store credits.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 mt-4 border-t border-emerald-100 text-xs">
          <div className="space-y-1">
            <span className="font-mono text-emerald-800 font-bold">01. SUBMIT DETAILS</span>
            <p className="text-emerald-700">Fill out condition metrics, brand labels, and expected prices.</p>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-emerald-800 font-bold">02. ADMIN AUDIT</span>
            <p className="text-emerald-700">Our physical verification experts review details in under 24 hours.</p>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-emerald-800 font-bold">03. SHIP & GET PAID</span>
            <p className="text-emerald-700">Receive prepaid shipping containers and get cash directly to Stripe/PayPal.</p>
          </div>
        </div>
      </div>

      {submittedConfirm && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl flex items-center gap-4 animate-fadeIn">
          <CheckCircle size={24} className="text-emerald-600 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm uppercase font-mono tracking-wider">Submission Routed Successfully!</h4>
            <p className="text-xs text-emerald-950 mt-0.5">Your vintage jersey details have been safely logged into the Admin Verification Desk queue. You will receive an email quote shortly.</p>
          </div>
          <button onClick={() => setSubmittedConfirm(false)} className="text-xs text-emerald-700 hover:text-emerald-950 uppercase font-bold ml-auto font-mono">Dismiss</button>
        </div>
      )}

      {/* Main Submission Form */}
      <form onSubmit={handleSubmit} className="bg-emerald-50/30 border border-emerald-100 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Parameters Inputs */}
        <div className="md:col-span-7 space-y-5">
          <h3 className="text-sm font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
            Shirt Specifications
          </h3>

          <div className="space-y-1.5">
            <label className="text-[10px] text-emerald-700 font-mono">JERSEY NAME / CLUB / NATIONAL TEAM:</label>
            <input
              type="text"
              required
              placeholder="e.g. 1996 Barcelona Home Cup Shirt"
              value={shirtName}
              onChange={(e) => setShirtName(e.target.value)}
              className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-700 font-mono">MANUFACTURING BRAND:</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 focus:outline-none text-emerald-950"
              >
                <option className="text-emerald-950">Adidas</option>
                <option className="text-emerald-950">Nike</option>
                <option className="text-emerald-950">Umbro</option>
                <option className="text-emerald-950">Puma</option>
                <option className="text-emerald-950">Reebok</option>
                <option className="text-emerald-950">Kappa</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-700 font-mono">HISTORICAL SEASON / YEAR:</label>
              <input
                type="text"
                required
                placeholder="e.g. 1996-98"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-700 font-mono">PHYSICAL CONDITION METRIC:</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 focus:outline-none text-emerald-950"
              >
                <option className="text-emerald-950">Mint (Brand New With Tags)</option>
                <option className="text-emerald-950">Excellent (No cracks or pulls)</option>
                <option className="text-emerald-950">Very Good (Minor bubble or wear)</option>
                <option className="text-emerald-950">Good (Wear on sponsor or logos)</option>
                <option className="text-emerald-950">Fair (Significant historical wear)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-emerald-700 font-mono block">EXPECTED CASH VALUE ($):</label>
              <div className="relative">
                <input
                  type="number"
                  required
                  placeholder="e.g. 150"
                  value={expectedPrice}
                  onChange={(e) => setExpectedPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 pl-10 pr-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-800 w-4.5 h-4.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Image Uploader */}
        <div className="md:col-span-5 space-y-5">
          <h3 className="text-sm font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
            Upload Proof Images
          </h3>

          {/* Drag & Drop uploader visual */}
          <div
            onClick={handleFileUploadMock}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
              dragOver
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-emerald-100 bg-white hover:border-emerald-200'
            }`}
          >
            <Upload size={32} className="text-emerald-700 mb-3" />
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-950">Drag & Drop shirt images here</p>
            <p className="text-[10px] text-emerald-700 mt-1">or click to choose files from device</p>
            <p className="text-[9px] font-mono text-emerald-800 mt-2">JPEG or PNG • Max 15MB size</p>
          </div>

          {/* List of uploaded files mockup */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <span className="text-[9px] text-emerald-700 font-mono uppercase block">Uploaded Files ({uploadedFiles.length}):</span>
              <div className="space-y-1.5">
                {uploadedFiles.map((file, idx) => (
                  <div key={idx} className="bg-white border border-emerald-100 p-2.5 rounded-xl flex justify-between items-center text-[10px]">
                    <span className="font-mono text-emerald-800">{file}</span>
                    <span className="text-emerald-700 font-bold uppercase font-mono">Uploaded ✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Secure declaration */}
          <div className="flex gap-2 text-[10px] text-emerald-700 leading-relaxed pt-2">
            <ShieldCheck size={16} className="text-emerald-800 flex-shrink-0" />
            <p>
              I certify that this shirt is a 100% genuine original manufactured vintage product, not a replica or counterfeit remake.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-full shadow-sm cursor-pointer"
          >
            Submit Jersey details
          </button>
        </div>

      </form>

    </section>
  );
};
