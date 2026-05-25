export type ValidationErrorItem = {
  loc: Array<string | number>;
  msg: string;
  type: string;
};

export class ApiError extends Error {
  status: number;
  detail: string;
  validationErrors: ValidationErrorItem[];

  constructor(status: number, detail: string, validationErrors: ValidationErrorItem[] = []) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.validationErrors = validationErrors;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
};

const API_BASE = "/api/v1";

function isObjectBody(body: RequestOptions["body"]): body is object {
  return typeof body === "object" && body !== null && !(body instanceof FormData) && !(body instanceof Blob);
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const body = options.body;

  if (isObjectBody(body)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
    body: isObjectBody(body) ? JSON.stringify(body) : body ?? undefined,
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload
        ? Array.isArray(payload.detail)
          ? "Ошибка валидации"
          : String(payload.detail)
        : `HTTP ${response.status}`;

    const validationErrors =
      typeof payload === "object" && payload !== null && "detail" in payload && Array.isArray(payload.detail)
        ? (payload.detail as ValidationErrorItem[])
        : [];

    throw new ApiError(response.status, detail, validationErrors);
  }

  return payload as T;
}
