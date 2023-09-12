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
  let res;
  res = await plugin.ownedObjectsOf(address);
  console.log(res);
  process.exit();
})()
