import hre from "hardhat";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const Voting = await hre.ethers.deployContract("Voting");
  await Voting.waitForDeployment();
  const address = await Voting.getAddress();
  console.log(`Voting contract deployed to: ${address}`);

  const clientSrcDir = join(__dirname, "../../client/src");
  if (!fs.existsSync(clientSrcDir)) {
    fs.mkdirSync(clientSrcDir, { recursive: true });
  }

  const data = {
    address: address,
    abi: JSON.parse(Voting.interface.formatJson())
  };

  fs.writeFileSync(
    join(clientSrcDir, "contractData.json"),
    JSON.stringify(data, null, 2)
  );
  console.log("Contract data saved to client/src/contractData.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
