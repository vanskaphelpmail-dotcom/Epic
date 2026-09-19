import { prisma } from '@jab/db';

const gallery = {
  title: 'JOIN THE VANSKAP COMMUNITY',
  membersLabel: '+6,783',
  subtitle: 'Members Since 2024.',
  facebookUrl: 'https://www.facebook.com/share/g/1DpkyuqPAh/?mibextid=wwXIfr',
  enabled: true,
  images: Array.from({ length: 14 }, (_, i) => ({
    id: `community-default-${i + 1}`,
    imageUrl: `/community/community-${i + 1}.png`,
    title: `Community ${i + 1}`,
    status: 'Active',
    sortOrder: i,
    size: i % 5 === 0 || i % 5 === 4 ? 'sm' : 'lg',
  })),
};

async function main() {
  const cur = await prisma.storeSettings.findUnique({
    where: { id: 'default' },
    select: { communityGallery: true },
  });

  console.log('before:', cur?.communityGallery ? 'HAS' : 'NULL');

  if (!cur?.communityGallery) {
    await prisma.storeSettings.update({
      where: { id: 'default' },
      data: { communityGallery: gallery },
    });
    console.log('seeded defaults');
  } else {
    const g = cur.communityGallery as Record<string, unknown>;
    console.log('already set', {
      enabled: g?.enabled,
      images: Array.isArray(g?.images) ? g.images.length : 0,
      title: g?.title,
    });
  }

  const after = await prisma.storeSettings.findUnique({
    where: { id: 'default' },
    select: { communityGallery: true },
  });
  const g = after?.communityGallery as Record<string, unknown> | null;
  console.log('after', {
    enabled: g?.enabled,
    images: Array.isArray(g?.images) ? g.images.length : 0,
    title: g?.title,
    facebookUrl: g?.facebookUrl,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
