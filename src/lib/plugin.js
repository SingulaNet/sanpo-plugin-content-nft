'use strict'

const debug = require('debug')('sanpo-plugin-contentnft');
const EventEmitter2 = require('eventemitter2').EventEmitter2;
const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;
const Common = require('ethereumjs-common').default;

const abi = require('../abi/ContentNFT.json');
const createWebsocketProvider = (provider) => new Web3.providers.WebsocketProvider(provider, {
  clientConfig: {
    maxReceivedFrameSize: 100000000,
    maxReceivedMessageSize: 100000000,
  }
});
const customCommon = Common.forCustomChain(
  'mainnet',
  {
    name: 'privatechain',
    networkId: 1,
    chainId: 11421,
  },
  'petersburg',
)

class PluginContentNft extends EventEmitter2 {
  constructor(opts) {
    super();
    this._primaryProvider = opts.provider;
    this._secondaryProvider = opts.altProvider || opts.provider;
    this.provider = this._primaryProvider;
    this.contractAddress = opts.contractAddress;
    this.web3 = null;
    this.healthCheck = false;
  }

  async connect() {
    debug(`connect... ${this.provider}`);

    if (!this.healthCheck) {
      this._heartbeat();
    }
    this.healthCheck = true;

    this.web3 = new Web3(createWebsocketProvider(this.provider));
    this.web3.eth.handleRevert = true;
    this.contract = new this.web3.eth.Contract(abi, this.contractAddress);
    this.web3.eth.transactionBlockTimeout = 20000;

    debug('registering DesignLog event handler');
    this.contract.events.DesignLog()
      .on('data', (event) => {
        debug('DesignLog event:');
        debug(event.returnValues);
        this.emit('Design', event.returnValues);
      })
      .on('error', console.error);

    debug('registering MintLog event handler');
    this.contract.events.MintLog()
      .on('data', (event) => {
        debug('MintLog event:');
        debug(event.returnValues);
        this.emit('Mint', event.returnValues);
      })
      .on('error', console.error);

    debug('registering TransferLog event handler');
    this.contract.events.TransferLog()
      .on('data', (event) => {
        debug('TransferLog event:');
        debug(event.returnValues);
        this.emit('TransferObject', event);
      })
      .on('error', console.error);
  }

  disconnect() {
    if (!this.web3) return;
    this.web3.currentProvider.disconnect();
    this.web3 = null;
  }

  _heartbeat() {
    setInterval(() => {
      /**
       * Handle web socket disconnects
       * @see https://github.com/ethereum/web3.js/issues/1354
       * @see https://github.com/ethereum/web3.js/issues/1933
       * It also serves as a heartbeat to node
       */
      if (this.web3) {
        this.web3.eth.net.isListening()
          .catch((e) => {
            debug("disconnected " + this.provider);
            this.web3.currentProvider.disconnect();
            this.web3 = null;
            if (this.provider === this._primaryProvider) {
              this.provider = this._secondaryProvider;
            } else {
              this.provider = this._primaryProvider;
            }
            const provider = createWebsocketProvider(this.provider);
            provider.on("connect", () => {
              this.connect();
            })
          })
      }

      // reconnect
      if (!this.web3) {
        if (this.provider === this._primaryProvider) {
          this.provider = this._secondaryProvider;
        } else {
          this.provider = this._primaryProvider;
        }
        debug("Attempting to reconnect... " + this.provider);
        const provider = createWebsocketProvider(this.provider);
        provider.on("connect", () => {
          this.connect();
        })
      }
    }, 5 * 1000);
  }

  /**
   * Execute design transaction
   * @param {string} address
   * @param {string} privateKey
   * @param {object} params
   * @returns
   */
  design(address, privateKey, opts) {
    const txData = this.contract.methods.design(
      opts.name,
      opts.symbol,
      opts.contentType,
      opts.mediaId,
      opts.thumbnailId,
      opts.totalSupplyLimit,
      opts.information,
      opts.agreements,
      opts.drm,
      opts.personaInformation,
      opts.secondarySales,
      opts.royalty,
      opts.deleted,
      opts.contractVersion,
    ).encodeABI();
    return this._sendSignedTransaction(address, privateKey, txData);
  }

  /**
   * Execute mint transaction
   * @param {string} address
   * @param {string} privateKey
   * @param {object} params
   * @returns
   */
  mint(address, privateKey, opts) {
    const txData = this.contract.methods.mint(
      opts.to,
      opts.specId,
      opts.mediaId,
      opts.information,
      opts.contractVersion,
    ).encodeABI();
    return this._sendSignedTransaction(address, privateKey, txData);
  }

  /**
   * Execute transfer transaction
   * @param {string} address
   * @param {string} privateKey
   * @param {object} params
   * @returns
   */
  transfer(address, privateKey, opts) {
    const txData = this.contract.methods.transfer(
      opts.to,
      opts.objectId,
    ).encodeABI();
    return this._sendSignedTransaction(address, privateKey, txData);
  }

  /**
   * Execute transferFrom transaction
   * @param {string} address
   * @param {string} privateKey
   * @param {object} params
   * @returns
   */
  transferFrom(address, privateKey, opts) {
    const txData = this.contract.methods.transferFrom(
      opts.from,
      opts.to,
      opts.objectId,
    ).encodeABI();
    return this._sendSignedTransaction(address, privateKey, txData);
  }

  async sendSignedTransaction(serializedTx) {
    return new Promise((resolve, reject) => {
      this.web3.eth.sendSignedTransaction(serializedTx)
      .on("confirmation", (confirmationNumber, receipt) => {
        if (confirmationNumber === 1) {
          resolve(receipt.transactionHash);
        }
      })
      .on("error", (error) =>  {
        console.error;
        reject(error);
      })
    });
  }

  /**
   * Send transaction
   * @param {string} from
   * @param {string} privateKey
   * @param {object} txData
   * @returns
   */
  async _sendSignedTransaction(from, privateKey, txData) {
    const nonce = await this.web3.eth.getTransactionCount(from, "pending");
    const rawTx = {
      from,
      to: this.contract.options.address,
      gas: 29900000,
      gasPrice: 0,
      data: txData,
      nonce: nonce,
    };
    const tx = new Tx(rawTx, { common: customCommon });
    tx.sign(Buffer.from(privateKey.split("0x")[1], "hex"));
    const serializedTx = tx.serialize();

    return new Promise((resolve, reject) => {
      this.web3.eth.sendSignedTransaction("0x" + serializedTx.toString("hex"))
        .on("confirmation", (confirmationNumber, receipt) => {
          if (confirmationNumber === 1) {
            resolve(receipt.transactionHash);
          }
        })
        .on("error", (error) => {
          console.error;
          reject(error);
        })
    });
  }

  /**
 *
 * @param {number} _objectId
 * @returns
 */
  objectIndexOf(_objectId) {
    return new Promise(resolve => {
      this.contract.methods.objectIndexOf(
        _objectId
      ).call()
        .then(result => {
          resolve(
            { objectIndex: result }
          );
        })
        .catch(error => {
          resolve({ error });
        });
    });
  }

  ownedSpecs(_address) {
    return new Promise(resolve => {
      this.contract.methods.ownedSpecs(
        _address
      ).call()
        .then(result => {
          resolve(
            { specs: result }
          );
        });
    });
  }

  getDigitalContentSpec(_specId) {
    return new Promise(resolve => {
      this.contract.methods.getDigitalContentSpec(
        _specId
      ).call()
        .then(result => {
          resolve(
            { spec: result }
          );
        });
    });
  }

  getDigitalContentObject(_objectId) {
    return new Promise((resolve, reject) => {
      this.contract.methods.getDigitalContentObject(
        _objectId
      ).call()
        .then(result => {
          resolve(
            { object: result }
          );
        }).catch((e) => {
          reject({ error: e });
        });
    });
  }

  specOwnerOf(_owner) {
    return new Promise(resolve => {
      this.contract.methods.specOwnerOf(
        _owner
      ).call()
        .then(result => {
          resolve(
            { owner: result }
          );
        });
    });
  }

  totalSupplyOf(_owner) {
    return new Promise(resolve => {
      this.contract.methods.totalSupplyOf(
        _owner
      ).call()
        .then(result => {
          resolve(
            { supply: result }
          );
        });
    });
  }

  objectBalanceOf(_owner) {
    return new Promise(resolve => {
      this.contract.methods.objectBalanceOf(
        _owner
      ).call()
        .then(result => {
          resolve(
            { _ownedObjectsCount: result }
          );
        });
    });
  }

  ownedObjectsOf(_owner) {
    return new Promise(resolve => {
      this.contract.methods.ownedObjectsOf(
        _owner
      ).call()
        .then(result => {
          resolve(
            { _ownedObjects: result }
          );
        });
    });
  }


  getNumberOfObjects() {
    return new Promise(resolve => {
      this.contract.methods.getNumberOfObjects()
        .call()
        .then(result => {
          resolve(
            { _numberOfObjects: result }
          );
        });
    });
  }

  getContractOwner() {
    return new Promise(resolve => {
      this.contract.methods.getContractOwner()
        .call()
        .then(result => {
          resolve(
            { owner: result }
          );
        });
    });
  }
}

module.exports = PluginContentNft;
