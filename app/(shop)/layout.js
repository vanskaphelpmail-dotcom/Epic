'use client';

import AppWorkspace from '../../components/AppWorkspace';

export default function ShopLayout({ children }) {
  return (
    <>
      <AppWorkspace />
      {children}
    </>
  );
}
