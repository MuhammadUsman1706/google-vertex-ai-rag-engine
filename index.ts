import { JWT } from "google-auth-library";
import type { JWTInput } from "google-auth-library";
import fs from "fs";
import path from "path";
import {
  GenerateContentRequest,
  Retrieval,
  Tool,
  VertexAI,
} from "@google-cloud/vertexai";
// Use require for JSON import
const keys = require("./fivegrid-ai-dev.json") as JWTInput;

const client = new JWT({
  email: keys.client_email,
  key: keys.private_key,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

// Define the OperationResponse model
interface OperationResponse {
  name: string;
  metadata: {
    "@type": string;
    genericMetadata: {
      createTime: string;
      updateTime: string;
    };
  };
}

interface RagCorpusResponse {
  name: string;
  metadata: {
    "@type": string;
    genericMetadata: {
      createTime: string;
      updateTime: string;
    };
  };
  done?: boolean;
  response?: {
    "@type": string;
    name: string;
    displayName: string;
    vectorDbConfig: {
      ragEmbeddingModelConfig: object;
    };
  };
}

interface DeleteRagCorpusResponse {
  name: string;
  metadata: {
    "@type": string;
    genericMetadata: {
      createTime: string;
      updateTime: string;
    };
  };
  done?: boolean;
  response?: {
    "@type": string;
  };
}

interface ImportRagFilesResponse {
  name: string;
  metadata: {
    "@type": string;
    genericMetadata: {
      createTime: string;
      updateTime: string;
    };
    importRagFilesConfig: object;
    progressPercentage: number;
  };
  done?: boolean;
  response?: {
    "@type": string;
    importedRagFilesCount: string;
  };
}

interface UploadRagFileResponse {
  error?: {
    code: number;
    message: string;
  };
  ragFile?: {
    name: string;
    displayName: string;
    directUploadSource: object;
  };
}

async function getRagCorpus(): Promise<any> {
  const corpusUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${keys.project_id}/locations/us-central1/ragCorpora?page_size=100`;

  const corpusResponse = await client.request({
    url: corpusUrl,
    method: "GET",
  });

  const data = corpusResponse.data as OperationResponse;

  console.log(data);

  return data;
}

async function createRagCorpus(): Promise<string> {
  const corpusUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${keys.project_id}/locations/us-central1/ragCorpora`;

  const operationResponse = await client.request({
    url: corpusUrl,
    method: "POST",
    data: { display_name: "user_2" },
  });

  const data = operationResponse.data as OperationResponse;

  console.log(`Created RAG corpus: ${data.name}`);

  // Poll the operation to check its status
  const operationUrl = `https://us-central1-aiplatform.googleapis.com/v1/${data.name}`;

  let operationComplete = false;
  let operationResult;

  while (!operationComplete) {
    const operationResponse = await client.request({
      url: operationUrl,
      method: "GET",
    });

    operationResult = operationResponse.data as RagCorpusResponse;

    if (operationResult?.done) {
      operationComplete = true;
      console.log("Operation completed:", operationResult);
    } else {
      console.log("Operation still in progress, waiting...");
      // Wait for 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return operationResult?.response?.name as string;
}

async function deleteRagCorpus(corpusId: string): Promise<void> {
  const deleteUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${keys.project_id}/locations/us-central1/ragCorpora/${corpusId}`;

  try {
    const response = await client.request({
      url: deleteUrl,
      method: "DELETE",
    });

    const data = response.data as OperationResponse;
    console.log(`Delete operation started: ${data.name}`);

    // Poll the operation to check its status
    const operationUrl = `https://us-central1-aiplatform.googleapis.com/v1/${data.name}`;

    let operationComplete = false;
    let operationResult;

    while (!operationComplete) {
      const operationResponse = await client.request({
        url: operationUrl,
        method: "GET",
      });

      operationResult = operationResponse.data as DeleteRagCorpusResponse;

      if (operationResult?.done) {
        operationComplete = true;
        console.log("Delete operation completed:", operationResult);
      } else {
        console.log("Delete operation still in progress, waiting...");
        // Wait for 2 seconds before checking again
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`RAG corpus ${corpusId} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting RAG corpus ${corpusId}:`, error);
    throw error;
  }
}

async function listRagFiles(corpusName: string) {
  const listFilesUrl = `https://us-central1-aiplatform.googleapis.com/v1/${corpusName}/ragFiles`;

  const response = await client.request({ url: listFilesUrl });
  // @ts-ignore
  return response.data || [];
}

async function importFiles(corpusName: string): Promise<void> {
  const importUrl = `https://us-central1-aiplatform.googleapis.com/v1/${corpusName}/ragFiles:import`;

  const response = await client.request({
    url: importUrl,
    method: "POST",
    data: {
      import_rag_files_config: {
        gcs_source: {
          uris: [
            "gs://surya-test-chatbot/software-engineer-resume-example.pdf",
          ],
        },
        // rag_file_chunking_config: {
        //   chunk_size: "1024",
        //   chunk_overlap: "100",
        // },
      },
    },
  });

  const data = response.data as OperationResponse;

  console.log(`Import operation started: ${data.name}`);

  // Poll the operation to check its status
  const operationUrl = `https://us-central1-aiplatform.googleapis.com/v1/${data.name}`;

  let operationComplete = false;
  let operationResult;

  while (!operationComplete) {
    const operationResponse = await client.request({
      url: operationUrl,
      method: "GET",
    });

    operationResult = operationResponse.data as ImportRagFilesResponse;

    if (operationResult?.done) {
      operationComplete = true;
      console.log("Import operation completed:", operationResult);
    } else {
      console.log("Import operation still in progress, waiting...");
      console.log(operationResult);
      // Wait for 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  const files = await listRagFiles(corpusName);

  console.log("Files Imported Successfully", files);
}

async function uploadFile(
  corpusName: string,
  filePath: string,
  description: string = ""
) {
  console.log(`Uploading file ${filePath} to corpus ${corpusName}...`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Get file name from path
  const fileName = path.basename(filePath);

  // Build the proper upload URL
  const uploadUrl = `https://us-central1-aiplatform.googleapis.com/upload/v1/${corpusName}/ragFiles:upload`;

  console.log(`Using upload URL: ${uploadUrl}`);

  // Create FormData-like structure for multipart request
  const boundary = `boundary-${Date.now()}`;
  const metadata = JSON.stringify({
    rag_file: {
      display_name: fileName,
      description: description,
    },
  });

  // Create multipart form data
  const fileContent = fs.readFileSync(filePath);
  const formData = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n`
    ),
    Buffer.from(metadata),
    Buffer.from(
      `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n\r\n`
    ),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  // Upload the file
  const response = await client.request({
    url: uploadUrl,
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "X-Goog-Upload-Protocol": "multipart",
    },
    body: formData,
  });

  const data = response.data as UploadRagFileResponse;

  if (data.error) {
    console.log("error " + data.error.message);
  } else {
    console.log(`File uploaded: ${data.ragFile?.name}`);
    const files = await listRagFiles(corpusName);
    console.log("Files fetched Successfully", files);
  }
}

async function makeRetreival(
  corpusName: string,
  queryText: string,
  topK: number = 5,
  threshold: number = 0.5
): Promise<any> {
  const queryUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${keys.project_id}/locations/us-central1:retrieveContexts`;

  try {
    const response = await client.request({
      url: queryUrl,
      method: "POST",
      data: {
        vertex_rag_store: {
          rag_resources: {
            rag_corpus: corpusName,
          },
          vector_distance_threshold: threshold,
        },
        query: {
          text: queryText,
          // similarity_top_k: topK,
        },
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error making query:", error);
    throw error;
  }
}

async function makeQuery(
  corpusName: string,
  prompt: string,
  modelId: string = "gemini-1.5-pro-002",
  topK: number = 5,
  threshold: number = 0.5
): Promise<any> {
  const location = "us-central1";
  const generationMethod = "generateContent";
  const queryUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${keys.project_id}/locations/${location}/publishers/google/models/${modelId}:${generationMethod}`;

  try {
    const response = await client.request({
      url: queryUrl,
      method: "POST",
      data: {
        contents: {
          role: "USER",
          parts: {
            text: prompt,
          },
        },
        tools: {
          retrieval: {
            disable_attribution: false,
            vertex_rag_store: {
              rag_resources: {
                rag_corpus: corpusName,
              },
              similarity_top_k: topK,
              vector_distance_threshold: threshold,
            },
          },
        },
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error making LLM query with RAG:", error);
    throw error;
  }
}

// Model query with system prompts
async function generateContentWithGoogleSearchGrounding(
  ragCorpus: string,
  model: string
) {
  // Initialize Vertex with your Cloud project and location
  const vertexAI = new VertexAI({
    location: "us-central1",
    project: keys.project_id,
    googleAuthOptions: { keyFile: "./fivegrid-ai-dev.json" },
  });

  const generativeModelPreview = vertexAI.preview.getGenerativeModel({
    model: model,
    generationConfig: { maxOutputTokens: 256 },
  });

  const retrieval: Retrieval = {
    vertexRagStore: {
      similarityTopK: 10,
      ragResources: [
        {
          ragCorpus,
        },
      ],
    },
  };

  const vertexAIRetrievalTool: Tool = {
    retrieval,
  };

  const request: GenerateContentRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "mujhe charles ki skills kai bare main detail se batana janu.",
          },
        ],
      },
    ],
    tools: [vertexAIRetrievalTool],
    generationConfig: { temperature: 1, topP: 0.95 },
    systemInstruction: {
      role: "system",
      parts: [
        {
          text: `You are a customer representative, you are to be nice and friendly! You can provide information either from the products list below or the data associated with our shop in the documents.

[
{
  "id": 1,
  "title": "Essence Mascara Lash Princess",
  "description": "The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects. Achieve dramatic lashes with this long-lasting and cruelty-free formula.",
  "category": "beauty",
  "price": 9.99,
  "discountPercentage": 7.17,
  "rating": 4.94,
  "stock": 5,
  "tags": [
    "beauty",
    "mascara"
  ],
  "brand": "Essence",
  "sku": "RCH45Q1A",
  "weight": 2,
  "dimensions": {
    "width": 23.17,
    "height": 14.43,
    "depth": 28.01
  },
  "warrantyInformation": "1 month warranty",
  "shippingInformation": "Ships in 1 month",
  "availabilityStatus": "Low Stock",
  "reviews": [
    {
      "rating": 2,
      "comment": "Very unhappy with my purchase!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "John Doe",
      "reviewerEmail": "john.doe@x.dummyjson.com"
    },
    {
      "rating": 2,
      "comment": "Not as described!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Nolan Gonzalez",
      "reviewerEmail": "nolan.gonzalez@x.dummyjson.com"
    },
    {
      "rating": 5,
      "comment": "Very satisfied!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Scarlett Wright",
      "reviewerEmail": "scarlett.wright@x.dummyjson.com"
    }
  ],
  "returnPolicy": "30 days return policy",
  "minimumOrderQuantity": 24,
  "meta": {
    "createdAt": "2024-05-23T08:56:21.618Z",
    "updatedAt": "2024-05-23T08:56:21.618Z",
    "barcode": "9164035109868",
    "qrCode": "https://assets.dummyjson.com/public/qr-code.png"
  },
  "images": [
    "https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/1.png"
  ],
  "thumbnail": "https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/thumbnail.png"
},
{
  "id": 2,
  "title": "Eyeshadow Palette with Mirror",
  "description": "The Eyeshadow Palette with Mirror offers a versatile range of eyeshadow shades for creating stunning eye looks. With a built-in mirror, it's convenient for on-the-go makeup application.",
  "category": "beauty",
  "price": 19.99,
  "discountPercentage": 5.5,
  "rating": 3.28,
  "stock": 44,
  "tags": [
    "beauty",
    "eyeshadow"
  ],
  "brand": "Glamour Beauty",
  "sku": "MVCFH27F",
  "weight": 3,
  "dimensions": {
    "width": 12.42,
    "height": 8.63,
    "depth": 29.13
  },
  "warrantyInformation": "1 year warranty",
  "shippingInformation": "Ships in 2 weeks",
  "availabilityStatus": "In Stock",
  "reviews": [
    {
      "rating": 4,
      "comment": "Very satisfied!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Liam Garcia",
      "reviewerEmail": "liam.garcia@x.dummyjson.com"
    },
    {
      "rating": 1,
      "comment": "Very disappointed!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Nora Russell",
      "reviewerEmail": "nora.russell@x.dummyjson.com"
    },
    {
      "rating": 5,
      "comment": "Highly impressed!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Elena Baker",
      "reviewerEmail": "elena.baker@x.dummyjson.com"
    }
  ],
  "returnPolicy": "30 days return policy",
  "minimumOrderQuantity": 32,
  "meta": {
    "createdAt": "2024-05-23T08:56:21.618Z",
    "updatedAt": "2024-05-23T08:56:21.618Z",
    "barcode": "2817839095220",
    "qrCode": "https://assets.dummyjson.com/public/qr-code.png"
  },
  "images": [
    "https://cdn.dummyjson.com/products/images/beauty/Eyeshadow%20Palette%20with%20Mirror/1.png"
  ],
  "thumbnail": "https://cdn.dummyjson.com/products/images/beauty/Eyeshadow%20Palette%20with%20Mirror/thumbnail.png"
},
{
  "id": 3,
  "title": "Powder Canister",
  "description": "The Powder Canister is a finely milled setting powder designed to set makeup and control shine. With a lightweight and translucent formula, it provides a smooth and matte finish.",
  "category": "beauty",
  "price": 14.99,
  "discountPercentage": 18.14,
  "rating": 3.82,
  "stock": 59,
  "tags": [
    "beauty",
    "face powder"
  ],
  "brand": "Velvet Touch",
  "sku": "9EN8WLT2",
  "weight": 8,
  "dimensions": {
    "width": 24.16,
    "height": 10.7,
    "depth": 11.07
  },
  "warrantyInformation": "2 year warranty",
  "shippingInformation": "Ships in 1-2 business days",
  "availabilityStatus": "In Stock",
  "reviews": [
    {
      "rating": 5,
      "comment": "Very happy with my purchase!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Ethan Thompson",
      "reviewerEmail": "ethan.thompson@x.dummyjson.com"
    },
    {
      "rating": 4,
      "comment": "Great value for money!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Levi Hicks",
      "reviewerEmail": "levi.hicks@x.dummyjson.com"
    },
    {
      "rating": 5,
      "comment": "Highly impressed!",
      "date": "2024-05-23T08:56:21.618Z",
      "reviewerName": "Hazel Gardner",
      "reviewerEmail": "hazel.gardner@x.dummyjson.com"
    }
  ],
  "returnPolicy": "60 days return policy",
  "minimumOrderQuantity": 25,
  "meta": {
    "createdAt": "2024-05-23T08:56:21.618Z",
    "updatedAt": "2024-05-23T08:56:21.618Z",
    "barcode": "0516267971277",
    "qrCode": "https://assets.dummyjson.com/public/qr-code.png"
  },
  "images": [
    "https://cdn.dummyjson.com/products/images/beauty/Powder%20Canister/1.png"
  ],
  "thumbnail": "https://cdn.dummyjson.com/products/images/beauty/Powder%20Canister/thumbnail.png"
},]`,
        },
      ],
    },
  };

  const result = await generativeModelPreview.generateContent(request);
  const response = await result.response;

  const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
  console.log(
    "Response: ",
    JSON.stringify(response?.candidates?.[0].content.parts[0].text)
  );
  console.log("GroundingMetadata is: ", JSON.stringify(groundingMetadata));
}

// Main execution
async function main() {
  try {
    // const corpusName = await createRagCorpus();
    // await getRagCorpus();
    // await deleteRagCorpus("4532873024948404224");
    // await importFiles(corpusName);
    // await uploadFile(corpusName, "./software-engineer-resume-example.pdf");
    // const retrieval = await makeRetreival("projects/fivegrid-ai-dev/locations/us-central1/ragCorpora/4749045807062188032","What is the name of the person in the resume?");
    // console.log(retrieval.contexts.contexts);
    // const query = await makeQuery("projects/fivegrid-ai-dev/locations/us-central1/ragCorpora/4749045807062188032","Write a greeting for the person in the resume, that includes his name and his details.");
    // console.log(query.candidates[0].content);

    await generateContentWithGoogleSearchGrounding(
      "projects/fivegrid-ai-dev/locations/us-central1/ragCorpora/4749045807062188032",
      "gemini-2.0-flash-001"
    );
  } catch (error) {
    console.error(error);
  }
}

main();
