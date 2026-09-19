import { prisma } from '@jab/db';

async function main() {
  const rows = await prisma.pageSection.findMany({
    where: { isHomepage: true },
    orderBy: { sortOrder: 'asc' },
  });

  console.log(
    'before',
    rows.map((r) => `${r.sortOrder}:${r.sectionKey}`).join(' | '),
  );

  const premier = rows.find((r) =>
    /premier|epl/i.test(`${r.sectionKey} ${r.title || ''} ${r.name || ''}`),
  );

  const existing = rows.find((r) => r.sectionKey === 'community-gallery');
  if (existing) {
    await prisma.pageSection.delete({ where: { id: existing.id } });
  }

  const insertOrder = premier ? premier.sortOrder + 1 : rows.length;

  // Shift everything after insert point up by 1
  const toShift = rows
    .filter((r) => r.sectionKey !== 'community-gallery' && r.sortOrder >= insertOrder)
    .sort((a, b) => b.sortOrder - a.sortOrder);

  for (const row of toShift) {
    await prisma.pageSection.update({
      where: { id: row.id },
      data: { sortOrder: row.sortOrder + 1 },
    });
  }

  await prisma.pageSection.create({
    data: {
      sectionKey: 'community-gallery',
      name: 'Community Gallery',
      visible: true,
      bgColor: 'bg-white',
      padding: 'py-14',
      margin: 'my-0',
      title: 'JOIN THE VANSKAP COMMUNITY',
      subtitle: '+6,783 Members Since 2024.',
      status: 'ACTIVE',
      sortOrder: insertOrder,
      isHomepage: true,
      animation: 'none',
      meta: { sectionType: 'content' },
    },
  });

  // Ensure gallery settings stay enabled
  const settings = await prisma.storeSettings.findUnique({ where: { id: 'default' } });
  const gallery =
    settings?.communityGallery && typeof settings.communityGallery === 'object'
      ? (settings.communityGallery as Record<string, unknown>)
      : {};
  await prisma.storeSettings.update({
    where: { id: 'default' },
    data: {
      communityGallery: {
        ...gallery,
        enabled: true,
        title: String(gallery.title || 'JOIN THE VANSKAP COMMUNITY'),
        membersLabel: String(gallery.membersLabel || '+6,783'),
        subtitle: String(gallery.subtitle || 'Members Since 2024.'),
        facebookUrl: String(
          gallery.facebookUrl ||
            'https://www.facebook.com/share/g/1DpkyuqPAh/?mibextid=wwXIfr',
        ),
        images: Array.isArray(gallery.images) ? gallery.images : [],
      },
    },
  });

  const after = await prisma.pageSection.findMany({
    where: { isHomepage: true },
    orderBy: { sortOrder: 'asc' },
    select: { sortOrder: true, sectionKey: true, title: true },
  });
  console.log(
    'after',
    after.map((r) => `${r.sortOrder}:${r.sectionKey}`).join(' | '),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
