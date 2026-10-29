// Missing API key or other setup problem — not worth retrying
export class AIConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = "AIConfigError"
  }
}

// The model answered but we could not use the answer (refusal, truncated, unparseable)
export class AIResponseError extends Error {
  constructor(message) {
    super(message)
    this.name = "AIResponseError"
  }
}
