import { Transform, Writable } from 'stream'
import { StringDecoder } from 'string_decoder'
import { WriteStream } from 'fs';

const decoder = new StringDecoder('utf8');

type Custom = {
  _last: any;
}

export const breakNewLine = new Transform({
  transform(chunk: any, encoding: any, cb: any) {
    const _this = (<Transform & Custom>this)
    if (_this._last === undefined) { _this._last = "" }
    _this._last += decoder.write(chunk);
    var list = _this._last.split(/\n/);
    _this._last = list.pop();
    for (var i = 0; i < list.length; i++) {
      this.push(list[i]);
    }
    cb();
  },

  flush(cb: Function) {
    const _this = (<Transform & Custom>this)
    _this._last += decoder.end()
    if (_this._last) { _this.push(_this, _this._last) }
    cb()
  }
})

export const streamPromise = (stream : WriteStream | Writable) : Promise<string> => {
  return new Promise((resolve, reject) => {
    stream.on('end', () => {
        resolve('end');
    });
    stream.on('finish', () => {
        resolve('finish');
    });
    stream.on('error', (error: Error) => {
        reject(error);
    });
  });
}
