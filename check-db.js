const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkImages() {
  try {
    // Check all problems
    const problems = await prisma.problem.findMany({
      include: {
        images: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log('Recent problems:');
    problems.forEach(problem => {
      console.log(`\nProblem #${problem.id}: ${problem.title}`);
      console.log(`Images: ${problem.images.length}`);
      problem.images.forEach(image => {
        console.log(`  - ${image.url} (${image.mimeType}, ${image.size} bytes)`);
      });
    });

    // Check all images
    const allImages = await prisma.problemImage.findMany();
    console.log(`\nTotal images in database: ${allImages.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkImages();
