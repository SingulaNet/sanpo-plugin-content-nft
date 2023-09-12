"use strict"

const PluginContentNft = require("../lib/plugin");
let plugin = null; // instance

(async () => {

  plugin = new PluginContentNft({
    provider: "",
    contractAddress: "",
  })
  await plugin.connect();

  const address = '';
  const privateKey = '';

  let res;
  const params = {
    to: "",
    objectId: 0,
  };

  res = await plugin.transfer(address, privateKey, params);
  console.log(res);

  process.exit();
})()
