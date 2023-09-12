"use strict"

const PluginContentNft = require("../lib/plugin");
let plugin = null; // instance

(async () => {

  plugin = new PluginContentNft({
    provider: "",
    contractAddress: "",
  })
  await plugin.connect();

  let res;
  res = await plugin.getDigitalContentSpec(0);
  console.log(res);
  process.exit();
})()
