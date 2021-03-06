import { 
    Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, 
    SystemProgram, TransactionInstruction, Transaction, 
    sendAndConfirmTransaction, 
} from '@solana/web3.js'; 
import fs from 'mz/fs'; 
import path from 'path';
import * as borsh from 'borsh';
import os from 'node:os';
import yaml from 'yaml';

let connection;

/**
 * Keypair associated to the fees' payer
 */
let payer;

/**
 * Hello world's program id
 */
let programId;

/**
 * The public key of the account we are saying hello to
 */
let greetedPubkey;

const PROGRAM_PATH = path.resolve(os.homedir(), 'DLT-Solana-01', 'solana-program', 'target', 'deploy');

const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'solana_program.so');

const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'solana_program-keypair.json');

async function getConfig(){
    // Path to Solana CLI config file
    const CONFIG_FILE_PATH = path.resolve(
      os.homedir(),
      '.config',
      'solana',
      'cli',
      'config.yml',
    );
    const configYml = await fs.readFile(CONFIG_FILE_PATH, {encoding: 'utf8'});
    return yaml.parse(configYml);
  }

  //Load and parse the Solana CLI config file to determine which RPC url to use
  export async function getRpcUrl() {
    try {
      const config = await getConfig();
      if (!config.json_rpc_url) throw new Error('Missing RPC URL');
      return config.json_rpc_url;
    } catch (err) {
      console.warn(
        'Failed to read RPC url from CLI config file, falling back to localhost',
      );
      return 'http://localhost:8899';
    }
  }
   //Load and parse the Solana CLI config file to determine which payer to use
  export async function getPayer(){
    try {
      const config = await getConfig();
      if (!config.keypair_path) throw new Error('Missing keypair path');
      return await createKeypairFromFile(config.keypair_path);
    } catch (err) {
      console.warn(
        'Failed to create keypair from CLI config file, falling back to new random keypair',
      );
      return Keypair.generate();
    }
  }
   // Create a Keypair from a secret key stored in file as bytes' array
  export async function createKeypairFromFile(filePath) {
    const secretKeyString = await fs.readFile(filePath, {encoding: 'utf8'});
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    return Keypair.fromSecretKey(secretKey);
  }

// The state of a greeting account managed by the hello world program
class GreetingAccount {
    counter = 0;
    constructor(fields) {
      if (fields) {
        this.counter = fields.counter;
      }
    }
  }

  //Borsh schema definition for greeting accounts
  const GreetingSchema = new Map([
    [GreetingAccount, {kind: 'struct', fields: [['counter', 'u32']]}],
  ]);


  //The expected size of each greeting account.
  const GREETING_SIZE = borsh.serialize(GreetingSchema,new GreetingAccount(),).length;

  //Establish a connection to the cluster
export async function establishConnection() {
    const rpcUrl = await getRpcUrl();
    connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('Connection to cluster established:', rpcUrl, version);
  }

  //Establish an account to pay for everything
export async function establishPayer() {
    let fees = 0;
    if (!payer) {
      const {feeCalculator} = await connection.getRecentBlockhash();
      // Calculate the cost to fund the greeter account
      fees += await connection.getMinimumBalanceForRentExemption(GREETING_SIZE);
      // Calculate the cost of sending transactions
      fees += feeCalculator.lamportsPerSignature * 100; // wag
      payer = await getPayer();
    }

    let lamports = await connection.getBalance(payer.publicKey);
    if (lamports < fees) {
      // If current balance is not enough to pay for fees, request an airdrop
      const sig = await connection.requestAirdrop(
        payer.publicKey,
        fees - lamports,
      );

      await connection.confirmTransaction(sig);
      lamports = await connection.getBalance(payer.publicKey);
    }
  
    console.log(
      'Using account',
      payer.publicKey.toBase58(),
      'containing',
      lamports / LAMPORTS_PER_SOL,
      'SOL to pay for fees',
    );
  }


  export async function checkProgram() {
    // Read program id from keypair file
    try {
      const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
      programId = programKeypair.publicKey;
    } catch (err) {
      const errMsg = 'Could not get the keypair';
      throw new Error(
        `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy rogram/helloworld.so\``,
      );
    }

    // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/helloworld.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);



  // Derive the address (public key) of a greeting account from the program so that it's easy to find later.
  const GREETING_SEED = 'hello';
  greetedPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    GREETING_SEED,
    programId,
  );

// Check if the greeting account has already been created
  const greetedAccount = await connection.getAccountInfo(greetedPubkey);
  if (greetedAccount === null) {
    console.log(
      'Creating account',
      greetedPubkey.toBase58(),
      'to say hello to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      GREETING_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: GREETING_SEED,
        newAccountPubkey: greetedPubkey,
        lamports,
        space: GREETING_SIZE,
        programId,
      }),
    );

    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}
  

// Say hello
export async function sayHello(){
    console.log('Saying hello to', greetedPubkey.toBase58());
    
    const instruction = new TransactionInstruction({
      keys: [{pubkey: greetedPubkey, isSigner: false, isWritable: true}],
      programId,
      data: Buffer.alloc(0), // All instructions are hellos
    });


    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer],
    );
  }


// Report the number of times the greeted account has been said hello to
export async function reportGreetings() {
  const accountInfo = await connection.getAccountInfo(greetedPubkey);
  if (accountInfo === null) {
    throw 'Error: cannot find the greeted account';
  }

  const greeting = borsh.deserialize(
    GreetingSchema,
    GreetingAccount,
    accountInfo.data,
  );

  console.log(
    greetedPubkey.toBase58(),
    'has been greeted',
    greeting.counter,
    'time(s)',
  );
}



const main = async() =>{
    console.log("Let's say hello to a Solana account...");

    // Establish connection to the cluster
    await establishConnection();
  
    // Determine who pays for the fees
    await establishPayer();
  
    // Check if the program has been deployed
    await checkProgram();
  
    // Say hello to an account
    await sayHello();
  
    // Find out how many times that account has been greeted
    await reportGreetings();
  
    console.log('Success');

  }

  main();
