import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata = {
  title: 'THE OUDS | Management',
  description: 'The Ouds perfume shop management — Cardiff',
  icons: {
    icon: [{ url: '/the-ouds-logo.png?v=3', type: 'image/png' }],
    apple: [{ url: '/the-ouds-logo.png?v=3' }]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <SpeedInsights sampleRate={1} />
        <Analytics />
      </body>
    </html>
  );
}
