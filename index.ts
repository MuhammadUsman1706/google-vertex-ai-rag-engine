import { JWT } from "google-auth-library";
import type { JWTInput } from "google-auth-library";
import fs from "fs";
import path from "path";
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
// async function generateContentWithGoogleSearchGrounding(
//   projectId = 'PROJECT_ID',
//   location = 'us-central1',
//   model = 'gemini-1.5-flash-001'
// ) {
//   // Initialize Vertex with your Cloud project and location
//   const vertexAI = new VertexAI({project: projectId, location: location});

//   const generativeModelPreview = vertexAI.preview.getGenerativeModel({
//     model: model,
//     generationConfig: {maxOutputTokens: 256},
//   });

//   const googleSearchRetrievalTool = {
//     googleSearchRetrieval: {},
//   };

//   const request = {
//     contents: [{role: 'user', parts: [{text: 'Why is the sky blue?'}]}],
//     tools: [googleSearchRetrievalTool],
//   };

//   const result = await generativeModelPreview.generateContent(request);
//   const response = await result.response;
//   const groundingMetadata = response.candidates[0].groundingMetadata;
//   console.log(
//     'Response: ',
//     JSON.stringify(response.candidates[0].content.parts[0].text)
//   );
//   console.log('GroundingMetadata is: ', JSON.stringify(groundingMetadata));
// }

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
  } catch (error) {
    console.error(error);
  }
}

main();
