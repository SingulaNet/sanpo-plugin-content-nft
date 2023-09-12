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
    name: "name",
    symbol: "symbol",
    contentType: "image",
    mediaId: "mediaId",
    thumbnailId: "thumbnailId",
    totalSupplyLimit: 100,
    information: ["info"],
    agreements: ["agreement"],
    drm: false,
    personaInformation: false,
    secondarySales: false,
    royalty: [0],
    deleted: false,
    contractVersion: 4,
  };

  res = await plugin.design(address, privateKey, params);
  console.log(res);

  process.exit();
})()
