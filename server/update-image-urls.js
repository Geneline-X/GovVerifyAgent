const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateImageUrls() {
  try {
    // Get all images
    const images = await prisma.problemImage.findMany();
    
    for (const image of images) {
      // Update with full server URL
      const updatedImage = await prisma.problemImage.update({
        where: { id: image.id },
        data: {
          url: `http://localhost:3800${image.url}`
        }
      });
      console.log(`Updated image ${image.id}: ${updatedImage.url}`);
    }
    
    console.log('All image URLs updated successfully');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateImageUrls();
