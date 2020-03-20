export default class WorkflowError extends Error {
  private _message?: string
  constructor(private error: Error, private source: string) {
    super()
    try {
      this.formatError()
    } catch (error) { }
  }
  formatError() {
    let error = this.error
    const stackArr = error.stack?.split(/\r?\n/) as Array<string>
    const line = stackArr.map(l => l.trim()).find(l => l.startsWith('at')) as string
    const [start, position] = line?.split('index.js:')
    const [lineNumber, column] = position.split(':')
    const sourceSnippet = this.source.split(/\r?\n/)[parseInt(lineNumber) -1]
    let insertAt = 2
    stackArr.splice(insertAt, 0, `\t>>${sourceSnippet}`)
    this._message = stackArr.join('\n')
  }
  toString() {
    return this._message || this.error.toString()
  }
  get message() {
    return this._message || this.error.toString()
  }
}