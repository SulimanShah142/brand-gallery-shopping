import { API_URL } from '@/lib/config';

// ============================================================
// CONFIG
// ============================================================

const VISUAL_SEARCH_ENDPOINT =
  `${API_URL}/api/products/visual-search`;

const HOME_VISUAL_SEARCH_ENDPOINT =
  `${API_URL}/api/products/visual-search/home`;

// ============================================================
// MOBILECLIP-S0 CONTRACT
// ============================================================

const VISUAL_SEARCH_MODEL =
  'mobileclip_s0';

const VISUAL_SEARCH_VERSION =
  'v1';

const VISUAL_SEARCH_DIMENSION =
  512;

const VISUAL_SEARCH_LIMIT =
  30;

// ============================================================
// TYPES
// ============================================================

export interface VisualSearchResult {
  rank: number;
  productId: string;
  score: number;
  matchedImageId: string;
}

export interface VisualSearchQuery {
  model: string;
  version: string;
  dimension: number;
  normalized: boolean;
  requestedLimit: number;
  categoryId?: string;
}

export interface VisualSearchResponse {
  success: true;

  query: VisualSearchQuery;

  search: {
    imageCandidates: number;
    uniqueProducts: number;
    finalResults: number;
  };

  count: number;

  results: VisualSearchResult[];

  requestId: string;
}

// ============================================================
// VALIDATION
// ============================================================

function validateCategoryId(
  categoryId?: string
): void {
  if (
    categoryId !== undefined &&
    !categoryId.trim()
  ) {
    throw new Error(
      'Visual search category is required.'
    );
  }
}

function validateEmbedding(
  embedding: number[]
): void {
  if (!Array.isArray(embedding)) {
    throw new Error(
      'Visual search embedding must be an array.'
    );
  }

  if (
    embedding.length !==
    VISUAL_SEARCH_DIMENSION
  ) {
    throw new Error(
      `Invalid visual search embedding dimension. Expected ${VISUAL_SEARCH_DIMENSION}, received ${embedding.length}.`
    );
  }

  let squaredSum = 0;

  for (
    let index = 0;
    index < embedding.length;
    index++
  ) {
    const value =
      embedding[index];

    if (!Number.isFinite(value)) {
      throw new Error(
        `Visual search embedding contains an invalid value at index ${index}.`
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
      `Visual search embedding has an invalid norm: ${norm}.`
    );
  }

  // generateVisualEmbedding()
  // already performs L2 normalization.
  //
  // Keep this client-side guard so an accidentally
  // unnormalized embedding cannot be sent to the API.

  if (
    Math.abs(norm - 1) >
    0.01
  ) {
    throw new Error(
      `Visual search embedding is not normalized. Norm=${norm}`
    );
  }
}

// ============================================================
// RESPONSE HELPERS
// ============================================================

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null
  );
}

// ============================================================
// QUERY PARSER
// ============================================================

function parseQuery(
  value: unknown
): VisualSearchQuery {
  if (!isRecord(value)) {
    throw new Error(
      'Visual search response is missing query information.'
    );
  }

  const model =
    typeof value.model === 'string'
      ? value.model
      : VISUAL_SEARCH_MODEL;

  const version =
    typeof value.version === 'string'
      ? value.version
      : VISUAL_SEARCH_VERSION;

  const dimension =
    Number(
      value.dimension
    );

  const normalized =
    value.normalized === true;

  const requestedLimit =
    Number(
      value.requestedLimit
    );

  const categoryId =
    typeof value.categoryId === 'string'
      ? value.categoryId
      : undefined;

  // ----------------------------------------------------------
  // MODEL CONTRACT
  // ----------------------------------------------------------

  if (
    model !==
    VISUAL_SEARCH_MODEL
  ) {
    throw new Error(
      `Unexpected visual search model in response: ${model}. Expected ${VISUAL_SEARCH_MODEL}.`
    );
  }

  if (
    version !==
    VISUAL_SEARCH_VERSION
  ) {
    throw new Error(
      `Unexpected visual search version in response: ${version}. Expected ${VISUAL_SEARCH_VERSION}.`
    );
  }

  if (
    dimension !==
    VISUAL_SEARCH_DIMENSION
  ) {
    throw new Error(
      `Unexpected visual search dimension in response: ${dimension}. Expected ${VISUAL_SEARCH_DIMENSION}.`
    );
  }

  if (!normalized) {
    throw new Error(
      'Visual search response indicates an unnormalized query.'
    );
  }

  if (
    !Number.isInteger(
      requestedLimit
    ) ||
    requestedLimit <= 0
  ) {
    throw new Error(
      'Visual search response contains an invalid requested limit.'
    );
  }

  return {
    model,
    version,
    dimension,
    normalized,
    requestedLimit,
    categoryId,
  };
}

// ============================================================
// SEARCH PARSER
// ============================================================

function parseSearch(
  value: unknown
): VisualSearchResponse['search'] {
  if (!isRecord(value)) {
    return {
      imageCandidates: 0,
      uniqueProducts: 0,
      finalResults: 0,
    };
  }

  const imageCandidates =
    Number(
      value.imageCandidates
    );

  const uniqueProducts =
    Number(
      value.uniqueProducts
    );

  const finalResults =
    Number(
      value.finalResults
    );

  return {
    imageCandidates:
      Number.isFinite(
        imageCandidates
      ) &&
      imageCandidates >= 0
        ? Math.trunc(
            imageCandidates
          )
        : 0,

    uniqueProducts:
      Number.isFinite(
        uniqueProducts
      ) &&
      uniqueProducts >= 0
        ? Math.trunc(
            uniqueProducts
          )
        : 0,

    finalResults:
      Number.isFinite(
        finalResults
      ) &&
      finalResults >= 0
        ? Math.trunc(
            finalResults
          )
        : 0,
  };
}

// ============================================================
// RESPONSE PARSING
// ============================================================

function parseResponse(
  data: unknown,
  status: number
): VisualSearchResponse {
  if (!isRecord(data)) {
    throw new Error(
      `Invalid visual search response (${status}).`
    );
  }

  if (
    data.success !== true
  ) {
    throw new Error(
      'Visual search request was not successful.'
    );
  }

  if (
    typeof data.requestId !==
    'string'
  ) {
    throw new Error(
      'Visual search response is missing requestId.'
    );
  }

  if (
    !Array.isArray(
      data.results
    )
  ) {
    throw new Error(
      'Visual search response is missing results.'
    );
  }

  const query =
    parseQuery(
      data.query
    );

  const search =
    parseSearch(
      data.search
    );

  const results:
    VisualSearchResult[] = [];

  for (
    const item of data.results
  ) {
    if (!isRecord(item)) {
      continue;
    }

    if (
      typeof item.productId !==
      'string'
    ) {
      continue;
    }

    if (
      typeof item.matchedImageId !==
      'string'
    ) {
      continue;
    }

    const rank =
      Number(
        item.rank
      );

    if (
      !Number.isInteger(rank) ||
      rank < 1
    ) {
      continue;
    }

    const score =
      Number(
        item.score
      );

    if (
      !Number.isFinite(score)
    ) {
      continue;
    }

    results.push({
      rank,

      productId:
        item.productId,

      score,

      matchedImageId:
        item.matchedImageId,
    });
  }

  return {
    success: true,

    query,

    search,

    count:
      results.length,

    results,

    requestId:
      data.requestId,
  };
}

// ============================================================
// SEARCH API
// ============================================================

export async function searchProductsByEmbedding(
  embedding: number[],
  categoryId?: string,
  productId?: string,
  discoverCategory = false
): Promise<VisualSearchResponse> {
  // ----------------------------------------------------------
  // Validate embedding
  // ----------------------------------------------------------

  validateEmbedding(
    embedding
  );

  // ----------------------------------------------------------
  // Validate category
  // ----------------------------------------------------------

  validateCategoryId(
    categoryId
  );

  const normalizedCategoryId =
    categoryId?.trim() ||
    undefined;

  const normalizedProductId =
    productId?.trim() ||
    undefined;

  // ----------------------------------------------------------
  // Endpoint
  //
  // IMPORTANT:
  // discoverCategory only chooses the /home endpoint.
  // The backend still owns category inference logic.
  // ----------------------------------------------------------

  const endpoint =
    discoverCategory
      ? HOME_VISUAL_SEARCH_ENDPOINT
      : VISUAL_SEARCH_ENDPOINT;

  console.log(
    '🔎 Sending MobileCLIP-S0 visual search request...',
    {
      endpoint,

      model:
        VISUAL_SEARCH_MODEL,

      version:
        VISUAL_SEARCH_VERSION,

      dimension:
        embedding.length,

      normalized:
        true,

      categoryId:
        normalizedCategoryId,

      productId:
        normalizedProductId,

      limit:
        VISUAL_SEARCH_LIMIT,
    }
  );

  // ----------------------------------------------------------
  // HTTP REQUEST
  // ----------------------------------------------------------

  let response: Response;

  try {
    response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Accept:
              'application/json',
          },

          body:
            JSON.stringify({
              embedding,

              ...(normalizedCategoryId
                ? {
                    categoryId:
                      normalizedCategoryId,
                  }
                : {}),

              ...(normalizedProductId
                ? {
                    productId:
                      normalizedProductId,
                  }
                : {}),

              model:
                VISUAL_SEARCH_MODEL,

              version:
                VISUAL_SEARCH_VERSION,

              limit:
                VISUAL_SEARCH_LIMIT,
            }),
        }
      );
  } catch (error) {
    console.error(
      '❌ MobileCLIP-S0 visual search network error:',
      error
    );

    throw new Error(
      'Unable to connect to the visual search service.'
    );
  }

  // ----------------------------------------------------------
  // RESPONSE JSON
  // ----------------------------------------------------------

  let data: unknown;

  try {
    data =
      await response.json();
  } catch (error) {
    console.error(
      '❌ Invalid visual search JSON response:',
      error
    );

    throw new Error(
      `Visual search returned invalid JSON (${response.status}).`
    );
  }

  // ----------------------------------------------------------
  // HTTP ERROR
  // ----------------------------------------------------------

  if (!response.ok) {
    let message =
      'Visual search failed.';

    if (
      isRecord(data) &&
      typeof data.error ===
        'string'
    ) {
      message =
        data.error;
    }

    console.error(
      '❌ Visual search API error:',
      {
        status:
          response.status,

        message,

        data,
      }
    );

    throw new Error(
      message
    );
  }

  // ----------------------------------------------------------
  // PARSE RESPONSE
  // ----------------------------------------------------------

  const parsed =
    parseResponse(
      data,
      response.status
    );

  // ----------------------------------------------------------
  // CATEGORY SAFETY CHECK
  //
  // Only enforce this when the caller explicitly
  // supplied a category.
  //
  // When /home is allowed to infer the category,
  // the backend is expected to return the inferred
  // categoryId.
  // ----------------------------------------------------------

  if (
    normalizedCategoryId !==
      undefined &&
    parsed.query.categoryId !==
      normalizedCategoryId
  ) {
    console.error(
      '❌ Visual search category mismatch:',
      {
        requested:
          normalizedCategoryId,

        returned:
          parsed.query.categoryId,

        requestId:
          parsed.requestId,
      }
    );

    throw new Error(
      'Visual search returned results for an unexpected category.'
    );
  }

  // ----------------------------------------------------------
  // DIAGNOSTICS
  // ----------------------------------------------------------

  console.log(
    '✅ MobileCLIP-S0 visual search response:',
    {
      requestId:
        parsed.requestId,

      model:
        parsed.query.model,

      version:
        parsed.query.version,

      dimension:
        parsed.query.dimension,

      normalized:
        parsed.query.normalized,

      categoryId:
        parsed.query.categoryId,

      imageCandidates:
        parsed.search.imageCandidates,

      uniqueProducts:
        parsed.search.uniqueProducts,

      count:
        parsed.results.length,

      bestScore:
        parsed.results.length > 0
          ? parsed.results[0].score
          : null,
    }
  );

  return parsed;
}

// ============================================================
// HOME VISUAL SEARCH
// ============================================================

export function searchHomeProductsByEmbedding(
  embedding: number[],
  categoryId: string
): Promise<VisualSearchResponse> {
  const normalizedCategoryId =
    categoryId?.trim();

  if (
    !normalizedCategoryId
  ) {
    throw new Error(
      'Please select a category before starting visual search.'
    );
  }

  return searchProductsByEmbedding(
    embedding,
    normalizedCategoryId,
    undefined,
    true
  );
}