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
    specId: 0,
    mediaId: "mediaId",
    information: ["information"],
    contractVersion: 4,
  };

  res = await plugin.mint(address, privateKey, params);
  console.log(res);

  process.exit();
})()
