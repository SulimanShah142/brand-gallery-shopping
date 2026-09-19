
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import UPNG from 'upng-js';
import type * as Ort from 'onnxruntime-react-native';

type OrtRuntime = typeof import('onnxruntime-react-native');

let ortRuntime: OrtRuntime | null = null;

export function isVisualSearchAvailable(): boolean {
  return Boolean(ortRuntime);
}

async function getOrtRuntime(): Promise<OrtRuntime> {
  if (ortRuntime) return ortRuntime;

  try {
    const loadedModule = await import('onnxruntime-react-native') as OrtRuntime & {
      default?: OrtRuntime;
    };

    const runtime = loadedModule.default ?? loadedModule;

    if (!runtime.InferenceSession || !runtime.Tensor) {
      throw new Error('ONNX Runtime loaded without InferenceSession or Tensor exports.');
    }

    ortRuntime = runtime;
    return ortRuntime;
  } catch (error) {
    console.warn('Visual search native runtime is unavailable:', error);
    throw new Error(
      'Visual search is unavailable in this app build. Install a fresh EAS development APK built after adding ONNX Runtime support.'
    );
  }
}

// ============================================================
// CONFIG
// ============================================================

const IMAGE_SIZE = 256;
const CHANNELS = 3;

const INPUT_LENGTH =
  IMAGE_SIZE *
  IMAGE_SIZE *
  CHANNELS;

const INPUT_BYTES =
  INPUT_LENGTH *
  Float32Array.BYTES_PER_ELEMENT;

const EMBEDDING_DIMENSION = 512;

const MODEL_NAME = 'mobileclip_s0';
const MODEL_VERSION = 'v1';
const PREPROCESSING_VERSION = 'v1';

// IMPORTANT:
// This ONNX image encoder contains its weights in the model file.
//
// ONNX input:
//   image [1, 3, 256, 256] float32
//
// ONNX output:
//   embedding [1, 512] float32
//
const MODEL_ASSET =
  require('../assets/ml/mobileclip_s0_image_encoder_fp32_embedded.onnx');

const PERSISTENT_MODEL_DIRECTORY = `${FileSystem.documentDirectory}models/`;
const PERSISTENT_MODEL_URI = `${PERSISTENT_MODEL_DIRECTORY}mobileclip_s0_image_encoder_fp32_embedded.onnx`;

// ============================================================
// MODEL CACHE
// ============================================================

let modelPromise:
  Promise<Ort.InferenceSession> | null = null;

async function getModel(): Promise<Ort.InferenceSession> {
  if (modelPromise) {
    return modelPromise;
  }

  modelPromise = (async () => {
    const ort = await getOrtRuntime();

    console.log(
      '🧠 Loading MobileCLIP-S0 ONNX model...'
    );

    const persistentModel = await FileSystem.getInfoAsync(PERSISTENT_MODEL_URI);
    const hasUsablePersistentModel =
      persistentModel.exists &&
      !persistentModel.isDirectory &&
      (persistentModel.size ?? 0) > 0;
    const modelUri = PERSISTENT_MODEL_URI;

    if (!hasUsablePersistentModel) {
      const modelAsset = Asset.fromModule(MODEL_ASSET);
      await modelAsset.downloadAsync();

      if (!modelAsset.localUri) {
        throw new Error('MobileCLIP-S0 ONNX model has no localUri after download.');
      }

      if (persistentModel.exists) {
        await FileSystem.deleteAsync(PERSISTENT_MODEL_URI, { idempotent: true });
      }

      await FileSystem.makeDirectoryAsync(PERSISTENT_MODEL_DIRECTORY, {
        intermediates: true,
      });
      await FileSystem.copyAsync({
        from: modelAsset.localUri,
        to: PERSISTENT_MODEL_URI,
      });

      console.log('✅ MobileCLIP-S0 ONNX model persisted for future launches.');
    } else {
      console.log('✅ Reusing persisted MobileCLIP-S0 ONNX model.');
    }

    console.log(
      '🧠 MobileCLIP-S0 ONNX URI:',
      modelUri
    );

    // ----------------------------------------------------------
    // CREATE ONNX RUNTIME SESSION
    // ----------------------------------------------------------

    let session =
      await ort.InferenceSession.create(
        modelUri,
        {
          graphOptimizationLevel:
            'all',
        }
      );

    validateModelContract(
      session
    );

    console.log(
      '✅ MobileCLIP-S0 ONNX model loaded.'
    );

    console.log(
      '🧠 Model metadata:',
      {
        name:
          MODEL_NAME,

        version:
          MODEL_VERSION,

        preprocessingVersion:
          PREPROCESSING_VERSION,

        inputNames:
          session.inputNames,

        outputNames:
          session.outputNames,

        inputMetadata:
          session.inputMetadata,

        outputMetadata:
          session.outputMetadata,
      }
    );

    return session;
  })().catch((error) => {
    modelPromise = null;
    throw error;
  });

  return modelPromise;
}

export async function preloadVisualEmbeddingModel(): Promise<void> {
  await getModel();
}

// ============================================================
// MODEL CONTRACT
// ============================================================

function validateModelContract(
  model: Ort.InferenceSession
): void {
  // ----------------------------------------------------------
  // INPUT NAME
  // ----------------------------------------------------------

  if (
    model.inputNames.length !== 1 ||
    model.inputNames[0] !== 'image'
  ) {
    throw new Error(
      `Unexpected MobileCLIP-S0 input. Expected ["image"], received ${JSON.stringify(model.inputNames)}.`
    );
  }

  // ----------------------------------------------------------
  // OUTPUT NAME
  // ----------------------------------------------------------

  if (
    model.outputNames.length !== 1 ||
    model.outputNames[0] !== 'embedding'
  ) {
    throw new Error(
      `Unexpected MobileCLIP-S0 output. Expected ["embedding"], received ${JSON.stringify(model.outputNames)}.`
    );
  }

  // ----------------------------------------------------------
  // INPUT METADATA
  // ----------------------------------------------------------

  const inputMetadata =
    model.inputMetadata[0];

  if (!inputMetadata) {
    throw new Error(
      'MobileCLIP-S0 input metadata is missing.'
    );
  }

  console.log(
    '🧠 MobileCLIP-S0 input contract:',
    inputMetadata
  );

  // ----------------------------------------------------------
  // OUTPUT METADATA
  // ----------------------------------------------------------

  const outputMetadata =
    model.outputMetadata[0];

  if (!outputMetadata) {
    throw new Error(
      'MobileCLIP-S0 output metadata is missing.'
    );
  }

  console.log(
    '🧠 MobileCLIP-S0 output contract:',
    outputMetadata
  );
}

// ============================================================
// FILE → BYTES
// ============================================================

async function readFileBytes(
  uri: string
): Promise<Uint8Array> {
  if (!uri) {
    throw new Error(
      'Cannot read file: URI is empty.'
    );
  }

  const file =
    new File(uri);

  const base64 =
    await file.base64();

  if (!base64) {
    throw new Error(
      'Unable to read file data.'
    );
  }

  const binary =
    globalThis.atob(
      base64
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index < binary.length;
    index++
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      );
  }

  return bytes;
}

// ============================================================
// SOURCE IMAGE → PNG
// ============================================================

async function convertImageToPng(
  imageUri: string
): Promise<string> {
  console.log(
    '🖼️ Converting source image to PNG...'
  );

  const result =
    await ImageManipulator.manipulateAsync(
      imageUri,
      [],
      {
        compress: 0,

        format:
          ImageManipulator.SaveFormat.PNG,

        base64: false,
      }
    );

  if (!result.uri) {
    throw new Error(
      'Unable to convert source image to PNG.'
    );
  }

  console.log(
    '🖼️ Source PNG ready:',
    result.uri
  );

  return result.uri;
}

// ============================================================
// BILINEAR INTERPOLATION
//
// MobileCLIP official preprocessing uses BILINEAR.
// ============================================================

function bilinear(
  rgba: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): Float32Array {
  const output =
    new Float32Array(
      targetWidth *
        targetHeight *
        4
    );

  const scaleX =
    sourceWidth /
    targetWidth;

  const scaleY =
    sourceHeight /
    targetHeight;

  for (
    let targetY = 0;
    targetY < targetHeight;
    targetY++
  ) {
    const sourceY =
      (targetY + 0.5) *
        scaleY -
      0.5;

    const yFloor =
      Math.floor(
        sourceY
      );

    const y0 =
      Math.max(
        0,
        yFloor
      );

    const y1 =
      Math.min(
        sourceHeight - 1,
        y0 + 1
      );

    const yWeight =
      sourceY -
      yFloor;

    for (
      let targetX = 0;
      targetX < targetWidth;
      targetX++
    ) {
      const sourceX =
        (targetX + 0.5) *
          scaleX -
        0.5;

      const xFloor =
        Math.floor(
          sourceX
        );

      const x0 =
        Math.max(
          0,
          xFloor
        );

      const x1 =
        Math.min(
          sourceWidth - 1,
          x0 + 1
        );

      const xWeight =
        sourceX -
        xFloor;

      const index00 =
        (y0 *
          sourceWidth +
          x0) *
        4;

      const index01 =
        (y0 *
          sourceWidth +
          x1) *
        4;

      const index10 =
        (y1 *
          sourceWidth +
          x0) *
        4;

      const index11 =
        (y1 *
          sourceWidth +
          x1) *
        4;

      const targetIndex =
        (targetY *
          targetWidth +
          targetX) *
        4;

      for (
        let channel = 0;
        channel < 4;
        channel++
      ) {
        const top =
          rgba[index00 + channel] *
            (1 - xWeight) +
          rgba[index01 + channel] *
            xWeight;

        const bottom =
          rgba[index10 + channel] *
            (1 - xWeight) +
          rgba[index11 + channel] *
            xWeight;

        output[
          targetIndex +
            channel
        ] =
          top *
            (1 - yWeight) +
          bottom *
            yWeight;
      }
    }
  }

  return output;
}

// ============================================================
// RESIZE SHORT EDGE → 256
// ============================================================

function resizeShortestSide(
  rgba: Uint8Array,
  sourceWidth: number,
  sourceHeight: number
): {
  rgba: Float32Array;
  width: number;
  height: number;
} {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error(
      `Invalid source dimensions: ${sourceWidth}x${sourceHeight}.`
    );
  }

  const scale =
    IMAGE_SIZE /
    Math.min(
      sourceWidth,
      sourceHeight
    );

  const targetWidth =
    Math.round(
      sourceWidth *
        scale
    );

  const targetHeight =
    Math.round(
      sourceHeight *
        scale
    );

  console.log(
    '🧮 MobileCLIP resize:',
    {
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight,
      interpolation:
        'bilinear',
    }
  );

  const resized =
    bilinear(
      rgba,
      sourceWidth,
      sourceHeight,
      targetWidth,
      targetHeight
    );

  return {
    rgba:
      resized,

    width:
      targetWidth,

    height:
      targetHeight,
  };
}

// ============================================================
// CENTER CROP → 256 × 256
//
// Returns RGB in HWC layout:
// [256, 256, 3]
// ============================================================

function centerCropToRgb(
  rgba: Float32Array,
  sourceWidth: number,
  sourceHeight: number
): Float32Array {
  if (
    sourceWidth < IMAGE_SIZE ||
    sourceHeight < IMAGE_SIZE
  ) {
    throw new Error(
      `Image is smaller than ${IMAGE_SIZE}×${IMAGE_SIZE} after resize: ${sourceWidth}×${sourceHeight}.`
    );
  }

  const cropX =
    Math.floor(
      (sourceWidth -
        IMAGE_SIZE) /
        2
    );

  const cropY =
    Math.floor(
      (sourceHeight -
        IMAGE_SIZE) /
        2
    );

  const output =
    new Float32Array(
      INPUT_LENGTH
    );

  for (
    let y = 0;
    y < IMAGE_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < IMAGE_SIZE;
      x++
    ) {
      const sourceX =
        cropX + x;

      const sourceY =
        cropY + y;

      const sourceIndex =
        (sourceY *
          sourceWidth +
          sourceX) *
        4;

      const targetIndex =
        (y *
          IMAGE_SIZE +
          x) *
        3;

      output[
        targetIndex
      ] =
        rgba[
          sourceIndex
        ];

      output[
        targetIndex + 1
      ] =
        rgba[
          sourceIndex + 1
        ];

      output[
        targetIndex + 2
      ] =
        rgba[
          sourceIndex + 2
        ];
    }
  }

  return output;
}

// ============================================================
// RGB → FLOAT32 [0,1]
//
// HWC → NCHW
//
// IMPORTANT:
//
// ONNX MODEL EXPECTS:
//
// [1, 3, 256, 256]
//
// NOT:
//
// [1, 256, 256, 3]
// ============================================================

function rgbToModelInput(
  rgb: Float32Array
): Float32Array {
  if (
    rgb.length !==
    INPUT_LENGTH
  ) {
    throw new Error(
      `Invalid RGB length: ${rgb.length}. Expected ${INPUT_LENGTH}.`
    );
  }

  const input =
    new Float32Array(
      INPUT_LENGTH
    );

  const planeSize =
    IMAGE_SIZE *
    IMAGE_SIZE;

  for (
    let y = 0;
    y < IMAGE_SIZE;
    y++
  ) {
    for (
      let x = 0;
      x < IMAGE_SIZE;
      x++
    ) {
      const pixelIndex =
        (y *
          IMAGE_SIZE +
          x) *
        3;

      const r =
        rgb[pixelIndex];

      const g =
        rgb[
          pixelIndex + 1
        ];

      const b =
        rgb[
          pixelIndex + 2
        ];

      if (
        !Number.isFinite(r) ||
        !Number.isFinite(g) ||
        !Number.isFinite(b)
      ) {
        throw new Error(
          `RGB input contains non-finite value at pixel ${x},${y}.`
        );
      }

      const red =
        Math.max(
          0,
          Math.min(
            255,
            r
          )
        ) / 255;

      const green =
        Math.max(
          0,
          Math.min(
            255,
            g
          )
        ) / 255;

      const blue =
        Math.max(
          0,
          Math.min(
            255,
            b
          )
        ) / 255;

      const spatialIndex =
        y *
          IMAGE_SIZE +
        x;

      // NCHW:
      //
      // channel 0 = R
      // channel 1 = G
      // channel 2 = B

      input[
        spatialIndex
      ] =
        red;

      input[
        planeSize +
          spatialIndex
      ] =
        green;

      input[
        planeSize * 2 +
          spatialIndex
      ] =
        blue;
    }
  }

  return input;
}

// ============================================================
// PNG → MODEL INPUT
// ============================================================

async function decodeImageToModelInput(
  pngUri: string
): Promise<Float32Array> {
  console.log(
    '🖼️ Decoding source PNG:'
  );

  const pngBytes =
    await readFileBytes(
      pngUri
    );

  if (
    pngBytes.length === 0
  ) {
    throw new Error(
      'PNG contains no bytes.'
    );
  }

  const pngBuffer =
    pngBytes.buffer.slice(
      pngBytes.byteOffset,
      pngBytes.byteOffset +
        pngBytes.byteLength
    ) as ArrayBuffer;

  const decoded =
    UPNG.decode(
      pngBuffer
    );

  if (!decoded) {
    throw new Error(
      'PNG decoder returned no image.'
    );
  }

  if (
    decoded.width <= 0 ||
    decoded.height <= 0
  ) {
    throw new Error(
      `Unexpected decoded dimensions: ${decoded.width}x${decoded.height}.`
    );
  }

  console.log(
    '🖼️ Decoded source image:',
    {
      width:
        decoded.width,

      height:
        decoded.height,
    }
  );

  const rgbaBuffer =
    UPNG.toRGBA8(
      decoded
    )[0];

  if (!rgbaBuffer) {
    throw new Error(
      'PNG decoder returned no RGBA data.'
    );
  }

  const expectedRgbaBytes =
    decoded.width *
    decoded.height *
    4;

  if (
    rgbaBuffer.byteLength <
    expectedRgbaBytes
  ) {
    throw new Error(
      `Invalid RGBA buffer. Received ${rgbaBuffer.byteLength} bytes, expected at least ${expectedRgbaBytes}.`
    );
  }

  const rgba =
    new Uint8Array(
      rgbaBuffer
    );

  // ----------------------------------------------------------
  // 1. Resize shortest edge to 256
  // ----------------------------------------------------------

  const resized =
    resizeShortestSide(
      rgba,
      decoded.width,
      decoded.height
    );

  // ----------------------------------------------------------
  // 2. Center crop to 256 × 256
  // ----------------------------------------------------------

  const rgb =
    centerCropToRgb(
      resized.rgba,
      resized.width,
      resized.height
    );

  // ----------------------------------------------------------
  // 3. RGB HWC → float32 NCHW
  // ----------------------------------------------------------

  const input =
    rgbToModelInput(
      rgb
    );

  validateInputPixels(
    input
  );

  logInputDiagnostics(
    input
  );

  return input;
}

// ============================================================
// INPUT VALIDATION
// ============================================================

function validateInputPixels(
  input: Float32Array
): void {
  if (
    input.length !==
    INPUT_LENGTH
  ) {
    throw new Error(
      `Invalid input length: ${input.length}. Expected ${INPUT_LENGTH}.`
    );
  }

  for (
    let index = 0;
    index < input.length;
    index++
  ) {
    const value =
      input[index];

    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Input contains a non-finite value at index ${index}.`
      );
    }

    if (
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        `Input pixel out of range at index ${index}: ${value}. Expected 0–1.`
      );
    }
  }
}

// ============================================================
// INPUT DIAGNOSTICS
// ============================================================

function logInputDiagnostics(
  input: Float32Array
): void {
  let min =
    Infinity;

  let max =
    -Infinity;

  let sum =
    0;

  for (
    let index = 0;
    index < input.length;
    index++
  ) {
    const value =
      input[index];

    if (value < min) {
      min =
        value;
    }

    if (value > max) {
      max =
        value;
    }

    sum +=
      value;
  }

  const mean =
    sum /
    input.length;

  console.log(
    '🧠 MobileCLIP-S0 input prepared:',
    {
      dtype:
        'float32',

      shape: [
        1,
        CHANNELS,
        IMAGE_SIZE,
        IMAGE_SIZE,
      ],

      layout:
        'NCHW',

      length:
        input.length,

      expectedLength:
        INPUT_LENGTH,

      bytes:
        input.byteLength,

      expectedBytes:
        INPUT_BYTES,

      pixelRange: [
        min,
        max,
      ],

      mean,

      preprocessing:
        'Resize shortest side → 256, center crop 256×256, RGB float32 / 255, HWC → NCHW',
    }
  );
}

// ============================================================
// IMAGE → MODEL INPUT
// ============================================================

async function imageToModelInput(
  imageUri: string
): Promise<Float32Array> {
  if (!imageUri) {
    throw new Error(
      'Image URI is required.'
    );
  }

  console.log(
    '🖼️ ========================================'
  );

  console.log(
    '🖼️ Preparing image for MobileCLIP-S0'
  );

  console.log(
    '🖼️ ========================================'
  );

  const pngUri =
    await convertImageToPng(
      imageUri
    );

  return decodeImageToModelInput(
    pngUri
  );
}

// ============================================================
// L2 NORMALIZATION
// ============================================================

function normalizeEmbedding(
  embedding: Float32Array
): number[] {
  if (
    embedding.length !==
    EMBEDDING_DIMENSION
  ) {
    throw new Error(
      `Cannot normalize embedding with dimension ${embedding.length}. Expected ${EMBEDDING_DIMENSION}.`
    );
  }

  let squaredSum =
    0;

  for (
    let index = 0;
    index < embedding.length;
    index++
  ) {
    const value =
      embedding[index];

    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Embedding contains a non-finite value at index ${index}.`
      );
    }

    squaredSum +=
      value * value;
  }

  const norm =
    Math.sqrt(
      squaredSum
    );

  if (
    !Number.isFinite(norm) ||
    norm <= 0
  ) {
    throw new Error(
      `Invalid embedding norm: ${norm}.`
    );
  }

  const normalized =
    new Array<number>(
      embedding.length
    );

  for (
    let index = 0;
    index < embedding.length;
    index++
  ) {
    normalized[index] =
      embedding[index] /
      norm;
  }

  return normalized;
}

// ============================================================
// EMBEDDING VALIDATION
// ============================================================

function validateEmbedding(
  embedding: number[]
): void {
  if (
    embedding.length !==
    EMBEDDING_DIMENSION
  ) {
    throw new Error(
      `Invalid embedding dimension: ${embedding.length}. Expected ${EMBEDDING_DIMENSION}.`
    );
  }

  let squaredSum =
    0;

  for (
    let index = 0;
    index < embedding.length;
    index++
  ) {
    const value =
      embedding[index];

    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Embedding contains invalid value at index ${index}.`
      );
    }

    squaredSum +=
      value * value;
  }

  const norm =
    Math.sqrt(
      squaredSum
    );

  if (
    !Number.isFinite(norm) ||
    norm <= 0
  ) {
    throw new Error(
      `Embedding has invalid L2 norm: ${norm}`
    );
  }

  if (
    Math.abs(norm - 1) >
    0.01
  ) {
    throw new Error(
      `Embedding is not properly normalized. Norm=${norm}`
    );
  }
}

// ============================================================
// EMBEDDING DIAGNOSTICS
// ============================================================

function logEmbeddingDiagnostics(
  embedding: Float32Array,
  normalized: number[]
): void {
  let rawSquaredSum =
    0;

  for (
    const value of embedding
  ) {
    rawSquaredSum +=
      value * value;
  }

  const rawNorm =
    Math.sqrt(
      rawSquaredSum
    );

  let normalizedSquaredSum =
    0;

  for (
    const value of normalized
  ) {
    normalizedSquaredSum +=
      value * value;
  }

  const normalizedNorm =
    Math.sqrt(
      normalizedSquaredSum
    );

  console.log(
    '🧠 MobileCLIP-S0 embedding diagnostics:',
    {
      dimension:
        normalized.length,

      rawNorm,

      normalizedNorm,

      firstValues:
        normalized.slice(
          0,
          10
        ),
    }
  );
}

// ============================================================
// PUBLIC API
// ============================================================

export async function generateVisualEmbedding(
  imageUri: string
): Promise<number[]> {
  if (!imageUri) {
    throw new Error(
      'An image URI is required.'
    );
  }

  console.log(
    '🔎 ========================================'
  );

  console.log(
    '🔎 Starting MobileCLIP-S0 embedding generation'
  );

  console.log(
    '🔎 ========================================'
  );

  const model =
    await getModel();

  const ort = await getOrtRuntime();

  const input =
    await imageToModelInput(
      imageUri
    );

  console.log(
    '🧠 Running MobileCLIP-S0 ONNX inference:',
    {
      inputLength:
        input.length,

      expectedInputLength:
        INPUT_LENGTH,

      inputBytes:
        input.byteLength,

      expectedInputBytes:
        INPUT_BYTES,

      shape: [
        1,
        CHANNELS,
        IMAGE_SIZE,
        IMAGE_SIZE,
      ],

      layout:
        'NCHW',
    }
  );

  if (
    input.length !==
    INPUT_LENGTH
  ) {
    throw new Error(
      `Invalid ONNX input length: ${input.length}. Expected ${INPUT_LENGTH}.`
    );
  }

  if (
    input.byteLength !==
    INPUT_BYTES
  ) {
    throw new Error(
      `Invalid ONNX input byte length: ${input.byteLength}. Expected ${INPUT_BYTES}.`
    );
  }

  // ----------------------------------------------------------
  // CREATE ONNX TENSOR
  // ----------------------------------------------------------

  const inputTensor =
    new ort.Tensor(
      'float32',
      input,
      [
        1,
        CHANNELS,
        IMAGE_SIZE,
        IMAGE_SIZE,
      ]
    );

  // ----------------------------------------------------------
  // RUN INFERENCE
  // ----------------------------------------------------------

  const outputs =
    await model.run({
      image:
        inputTensor,
    });

  if (!outputs) {
    throw new Error(
      'MobileCLIP-S0 ONNX returned no outputs.'
    );
  }

  const rawOutput =
    outputs.embedding;

  if (!rawOutput) {
    throw new Error(
      'MobileCLIP-S0 ONNX returned no "embedding" output.'
    );
  }

  const outputData =
    rawOutput.data;

  if (!outputData) {
    throw new Error(
      'MobileCLIP-S0 ONNX embedding tensor contains no data.'
    );
  }

  const embedding =
    outputData instanceof
    Float32Array
      ? outputData
      : new Float32Array(
          outputData as unknown as ArrayBuffer
        );

  console.log(
    '🧠 Raw MobileCLIP-S0 output:',
    {
      length:
        embedding.length,

      expected:
        EMBEDDING_DIMENSION,

      firstValues:
        Array.from(
          embedding.slice(
            0,
            10
          )
        ),
    }
  );

  if (
    embedding.length !==
    EMBEDDING_DIMENSION
  ) {
    throw new Error(
      `Invalid MobileCLIP-S0 output dimension. Expected ${EMBEDDING_DIMENSION}, received ${embedding.length}.`
    );
  }

  // ----------------------------------------------------------
  // L2 NORMALIZE
  // ----------------------------------------------------------

  const normalized =
    normalizeEmbedding(
      embedding
    );

  validateEmbedding(
    normalized
  );

  logEmbeddingDiagnostics(
    embedding,
    normalized
  );

  if (__DEV__) {
    console.log(
      '🧪 MobileCLIP-S0 parity embedding:',
      JSON.stringify(
        normalized
      )
    );
  }

  console.log(
    '✅ MobileCLIP-S0 visual embedding generated:',
    {
      model:
        MODEL_NAME,

      version:
        MODEL_VERSION,

      preprocessingVersion:
        PREPROCESSING_VERSION,

      dimension:
        normalized.length,

      normalized:
        true,

      firstValues:
        normalized.slice(
          0,
          5
        ),
    }
  );

  console.log(
    '🔎 ========================================'
  );

  return normalized;
}

