import Promise from "../promise.mjs";

const define = {
  eventAliasesOn: function (proto) {
    const p = proto;

    p.addListener = p.listen = p.bind = p.on;
    p.unlisten = p.unbind = p.off = p.removeListener;
    p.trigger = p.emit;

    // this is just a wrapper alias of .on()
    p.pon = p.promiseOn = function (events, selector) {
      const self = this;
      const args = Array.prototype.slice.call(arguments, 0);

      return new Promise(function (resolve, reject) {
        const callback = function (e) {
          self.off.apply(self, offArgs);

          resolve(e);
        };

        const onArgs = args.concat([callback]);
        const offArgs = onArgs.concat([]);

        self.on.apply(self, onArgs);
      });
    };
  },
}; // define

export default define;
