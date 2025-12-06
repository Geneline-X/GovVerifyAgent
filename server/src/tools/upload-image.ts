import {S3Client, PutObjectCommand} from "@aws-sdk/client-s3"
import { ToolDefinition, ToolHandler } from "./types";
import { logger } from "../logger";

export const uploadImageTool: ToolDefinition = {
    type: "function",
    function: {
        name: "upload_image",
        description: "Upload an image to S3 and return the URL.",
        parameters: {
            type: "object",
            properties: {
                image: {
                    type: "string",
                    description: "Base64 encoded image data",
                },
            },
            required: ["image"],
        },
    },
};

export const uploadImageHandler: ToolHandler = async (args, context) => {
    const { image } = args;
    const { prisma, currentUserPhone, currentProblemContext } = context;

    try {
        logger.info(
            { phone: currentUserPhone, image },
            "Uploading image"
        );

        const s3Client = new S3Client({
            region: process.env.AWS_REGION!,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });

        const putObjectCommand = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `${currentUserPhone}/${Date.now()}.jpg`,
            Body: Buffer.from(image, "base64"),
            ContentType: "image/jpeg",
        });

        await prisma.media.create({
            data: {
                url: `https://s3.amazonaws.com/${process.env.AWS_BUCKET_NAME}/${currentUserPhone}/${Date.now()}.jpg`,
                type: "image",
                problemId: currentProblemContext?.problemId,
            },
        });

        return {
            url: `https://s3.amazonaws.com/${process.env.AWS_BUCKET_NAME}/${currentUserPhone}/${Date.now()}.jpg`,
        };
    } catch (error) {
        logger.error({ error, phone: currentUserPhone }, "Failed to upload image");
        // Continue without image - don't fail the whole problem report
        return {
            url: "",
        };
    }
};