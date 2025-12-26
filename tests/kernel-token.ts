import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KernelToken } from "../target/types/kernel_token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("kernel-token", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KernelToken as Program<KernelToken>;
  const connection = provider.connection;

  // Test accounts
  let tokenMint: PublicKey;
  let authority: Keypair;
  let guardian: Keypair; // Guardian for multisig emergency operations
  let user1: Keypair;
  let user2: Keypair;

  // PDAs
  let configPda: PublicKey;
  let stakingVaultPda: PublicKey;
  let reflectionPoolPda: PublicKey;

  // Token accounts
  let authorityTokenAccount: PublicKey;
  let user1TokenAccount: PublicKey;
  let user2TokenAccount: PublicKey;

  // Test constants
  const INITIAL_MINT_AMOUNT = 1_000_000_000 * 10 ** 9; // 1B tokens
  const REFLECTION_BPS = 200; // 2%
  const LP_BPS = 200; // 2%
  const BURN_BPS = 100; // 1%

  before(async () => {
    // Generate test keypairs
    authority = Keypair.generate();
    guardian = Keypair.generate(); // Guardian for multisig emergency operations
    user1 = Keypair.generate();
    user2 = Keypair.generate();

    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;

    await Promise.all([
      connection.requestAirdrop(authority.publicKey, airdropAmount),
      connection.requestAirdrop(guardian.publicKey, airdropAmount),
      connection.requestAirdrop(user1.publicKey, airdropAmount),
      connection.requestAirdrop(user2.publicKey, airdropAmount),
    ]);

    // Wait for airdrops to confirm
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create Token-2022 mint
    tokenMint = await createMint(
      connection,
      authority,
      authority.publicKey,
      null,
      9, // decimals
      Keypair.generate(),
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    console.log("Token Mint:", tokenMint.toBase58());

    // Derive PDAs
    [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config"), tokenMint.toBuffer()],
      program.programId
    );

    [stakingVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_vault"), tokenMint.toBuffer()],
      program.programId
    );

    [reflectionPoolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reflection_pool"), tokenMint.toBuffer()],
      program.programId
    );

    console.log("Config PDA:", configPda.toBase58());
    console.log("Staking Vault PDA:", stakingVaultPda.toBase58());
    console.log("Reflection Pool PDA:", reflectionPoolPda.toBase58());

    // Create token accounts
    authorityTokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      authority.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    user1TokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      user1.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    user2TokenAccount = await createAssociatedTokenAccount(
      connection,
      authority,
      tokenMint,
      user2.publicKey,
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    // Mint initial tokens
    await mintTo(
      connection,
      authority,
      tokenMint,
      authorityTokenAccount,
      authority,
      BigInt(INITIAL_MINT_AMOUNT),
      [],
      { commitment: "confirmed" },
      TOKEN_2022_PROGRAM_ID
    );

    // Transfer tokens to users
    const userAmount = 100_000_000 * 10 ** 9; // 100M each

    // Use SPL transfer for user distributions
    const { createTransferInstruction } = await import("@solana/spl-token");

    const tx = new anchor.web3.Transaction();
    tx.add(
      createTransferInstruction(
        authorityTokenAccount,
        user1TokenAccount,
        authority.publicKey,
        BigInt(userAmount),
        [],
        TOKEN_2022_PROGRAM_ID
      ),
      createTransferInstruction(
        authorityTokenAccount,
        user2TokenAccount,
        authority.publicKey,
        BigInt(userAmount),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [authority]);

    console.log("Setup complete!");
  });

  describe("Initialize", () => {
    it("initializes the program correctly", async () => {
      const tx = await program.methods
        .initialize(REFLECTION_BPS, LP_BPS, BURN_BPS)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          stakingVault: stakingVaultPda,
          reflectionPool: reflectionPoolPda,
          config: configPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize tx:", tx);

      // Verify config
      const config = await program.account.kernelConfig.fetch(configPda);

      assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
      assert.equal(config.tokenMint.toBase58(), tokenMint.toBase58());
      assert.equal(config.reflectionShareBps, REFLECTION_BPS);
      assert.equal(config.lpShareBps, LP_BPS);
      assert.equal(config.burnShareBps, BURN_BPS);
      assert.equal(config.totalStaked.toNumber(), 0);
      assert.equal(config.isPaused, false);
    });

    it("fails with invalid fee configuration", async () => {
      // Create a new mint for this test
      const newMint = await createMint(
        connection,
        authority,
        authority.publicKey,
        null,
        9,
        Keypair.generate(),
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      const [newConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newMint.toBuffer()],
        program.programId
      );

      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("staking_vault"), newMint.toBuffer()],
        program.programId
      );

      const [newPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reflection_pool"), newMint.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .initialize(100, 100, 100) // Total 300, should be 500
          .accounts({
            authority: authority.publicKey,
            tokenMint: newMint,
            stakingVault: newVaultPda,
            reflectionPool: newPoolPda,
            config: newConfigPda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("InvalidFeeConfig");
      }
    });
  });

  describe("Staking", () => {
    const STAKE_AMOUNT = new anchor.BN(1_000_000 * 10 ** 9); // 1M tokens

    it("allows user to stake tokens", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .stake(STAKE_AMOUNT)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      console.log("Stake tx:", tx);

      // Verify user stake
      const userStake = await program.account.userStake.fetch(userStakePda);
      assert.equal(userStake.owner.toBase58(), user1.publicKey.toBase58());
      assert.equal(userStake.stakedAmount.toNumber(), STAKE_AMOUNT.toNumber());

      // Verify token balance decreased
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      assert.equal(
        Number(balanceBefore.amount) - Number(balanceAfter.amount),
        STAKE_AMOUNT.toNumber()
      );

      // Verify vault balance increased
      const vaultBalance = await getAccount(
        connection,
        stakingVaultPda,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(Number(vaultBalance.amount), STAKE_AMOUNT.toNumber());

      // Verify global config updated
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.totalStaked.toNumber(), STAKE_AMOUNT.toNumber());
    });

    it("fails to stake zero amount", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .stake(new anchor.BN(0))
          .accounts({
            owner: user2.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user2TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("ZeroAmount");
      }
    });

    it("allows additional staking", async () => {
      const additionalAmount = new anchor.BN(500_000 * 10 ** 9); // 500K more

      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stakeBefore = await program.account.userStake.fetch(userStakePda);

      const tx = await program.methods
        .stake(additionalAmount)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user1])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");

      const stakeAfter = await program.account.userStake.fetch(userStakePda);
      assert.equal(
        stakeAfter.stakedAmount.toNumber(),
        stakeBefore.stakedAmount.toNumber() + additionalAmount.toNumber()
      );
    });
  });

  describe("Unstaking", () => {
    it("allows user to unstake tokens", async () => {
      const unstakeAmount = new anchor.BN(500_000 * 10 ** 9); // 500K tokens

      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stakeBefore = await program.account.userStake.fetch(userStakePda);
      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .unstake(unstakeAmount)
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc({ commitment: "confirmed", skipPreflight: true });

      // Wait for confirmation and state propagation
      await connection.confirmTransaction(tx, "confirmed");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Unstake tx:", tx);

      // Verify stake decreased
      const stakeAfter = await program.account.userStake.fetch(userStakePda);
      assert.equal(
        stakeAfter.stakedAmount.toNumber(),
        stakeBefore.stakedAmount.toNumber() - unstakeAmount.toNumber()
      );

      // Verify balance increased
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(balanceAfter.amount) - Number(balanceBefore.amount),
        unstakeAmount.toNumber()
      );
    });

    it("fails to unstake more than staked", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const stake = await program.account.userStake.fetch(userStakePda);
      const tooMuch = stake.stakedAmount.add(new anchor.BN(1));

      try {
        await program.methods
          .unstake(tooMuch)
          .accounts({
            owner: user1.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user1TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("InsufficientStake");
      }
    });
  });

  describe("Reflections", () => {
    it("deposits reflections to pool", async () => {
      const depositAmount = new anchor.BN(100_000 * 10 ** 9); // 100K tokens

      const tx = await program.methods
        .depositReflections(depositAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          authorityTokenAccount,
          reflectionPool: reflectionPoolPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      console.log("Deposit reflections tx:", tx);

      // Verify reflection pool balance
      const poolBalance = await getAccount(
        connection,
        reflectionPoolPda,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(Number(poolBalance.amount), depositAmount.toNumber());

      // Verify config updated
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.pendingReflections.toNumber(), depositAmount.toNumber());
      assert.isTrue(config.accumulatedPerShare.gt(new anchor.BN(0)));
    });

    it("allows staker to claim reflections", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const balanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .claimReflections()
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          reflectionPool: reflectionPoolPda,
          userStake: userStakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      console.log("Claim reflections tx:", tx);

      // Verify balance increased (received reflections)
      const balanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.isTrue(Number(balanceAfter.amount) > Number(balanceBefore.amount));

      // Verify user stake updated
      const userStake = await program.account.userStake.fetch(userStakePda);
      assert.isTrue(userStake.totalClaimed.gt(new anchor.BN(0)));
      assert.equal(userStake.pendingRewards.toNumber(), 0);
    });

    it("fails to claim when nothing to claim", async () => {
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .claimReflections()
          .accounts({
            owner: user1.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user1TokenAccount,
            reflectionPool: reflectionPoolPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("NothingToClaim");
      }
    });
  });

  describe("Burn", () => {
    it("burns tokens", async () => {
      const burnAmount = new anchor.BN(50_000 * 10 ** 9); // 50K tokens

      const [burnRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("burn"), configPda.toBuffer()],
        program.programId
      );

      const supplyBefore = await getMint(
        connection,
        tokenMint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .burnTokens(burnAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          authorityTokenAccount,
          burnRecord: burnRecordPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation
      await connection.confirmTransaction(tx, "confirmed");
      console.log("Burn tx:", tx);

      // Verify supply decreased
      const supplyAfter = await getMint(
        connection,
        tokenMint,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(supplyBefore.supply) - Number(supplyAfter.supply),
        burnAmount.toNumber()
      );

      // Verify burn record
      const burnRecord = await program.account.burnRecord.fetch(burnRecordPda);
      assert.equal(burnRecord.totalBurned.toNumber(), burnAmount.toNumber());
      assert.equal(burnRecord.burnCount.toNumber(), 1);
    });
  });

  describe("Admin Functions", () => {
    it("pauses and unpauses the program", async () => {
      // Pause
      await program.methods
        .setPaused(true)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      let config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.isPaused, true);

      // Try to stake while paused
      const [userStakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .stake(new anchor.BN(1000))
          .accounts({
            owner: user2.publicKey,
            tokenMint,
            config: configPda,
            userTokenAccount: user2TokenAccount,
            stakingVault: stakingVaultPda,
            userStake: userStakePda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([user2])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("ProgramPaused");
      }

      // Unpause
      await program.methods
        .setPaused(false)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority])
        .rpc();

      config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.isPaused, false);
    });

    it("updates fee configuration with guardian co-signature", async () => {
      const newReflection = 250; // 2.5%
      const newLp = 150; // 1.5%
      const newBurn = 100; // 1%

      // Emergency fee update requires both authority AND guardian signatures (multisig)
      await program.methods
        .updateFees(newReflection, newLp, newBurn)
        .accounts({
          authority: authority.publicKey,
          guardian: guardian.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority, guardian])
        .rpc();

      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.reflectionShareBps, newReflection);
      assert.equal(config.lpShareBps, newLp);
      assert.equal(config.burnShareBps, newBurn);

      // Reset to original (also requires multisig)
      await program.methods
        .updateFees(REFLECTION_BPS, LP_BPS, BURN_BPS)
        .accounts({
          authority: authority.publicKey,
          guardian: guardian.publicKey,
          tokenMint,
          config: configPda,
        })
        .signers([authority, guardian])
        .rpc();
    });

    it("fails emergency update without guardian signature", async () => {
      try {
        // Attempt update with only authority (missing guardian)
        await program.methods
          .updateFees(300, 100, 100)
          .accounts({
            authority: authority.publicKey,
            guardian: user1.publicKey, // Wrong signer - user1 is not signing
            tokenMint,
            config: configPda,
          })
          .signers([authority]) // Only authority signing, guardian missing
          .rpc();

        assert.fail("Should have thrown error - guardian signature required");
      } catch (err: any) {
        // Expected: signature verification failure or missing signer error
        expect(err.message).to.satisfy((msg: string) =>
          msg.includes("Signature") || msg.includes("signature") || msg.includes("unknown signer")
        );
      }
    });

    it("prevents non-authority from proposing authority transfer", async () => {
      // This test must run BEFORE any proposal is created (no PDA exists yet)
      const newAuthority = Keypair.generate();

      const [pendingTransferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pending_authority_transfer"), configPda.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .proposeAuthorityTransfer(newAuthority.publicKey)
          .accounts({
            authority: user1.publicKey,
            tokenMint,
            config: configPda,
            pendingTransfer: pendingTransferPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown authority error");
      } catch (err: any) {
        const isAuthError = err.message.includes("NotAuthority") ||
                           err.message.includes("ConstraintHasOne") ||
                           err.message.includes("has_one") ||
                           err.message.includes("A has one constraint");
        expect(isAuthError).to.be.true;
      }
    });

    it("proposes authority transfer with timelock", async () => {
      const newAuthority = Keypair.generate();

      // Derive PDA for pending transfer
      const [pendingTransferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pending_authority_transfer"), configPda.toBuffer()],
        program.programId
      );

      // Propose authority transfer (starts 24-hour timelock)
      await program.methods
        .proposeAuthorityTransfer(newAuthority.publicKey)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          pendingTransfer: pendingTransferPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      // Verify proposal was created
      const transfer = await program.account.pendingAuthorityTransfer.fetch(pendingTransferPda);
      assert.equal(transfer.proposer.toBase58(), authority.publicKey.toBase58());
      assert.equal(transfer.newAuthority.toBase58(), newAuthority.publicKey.toBase58());
      assert.equal(transfer.executed, false);
      assert.equal(transfer.cancelled, false);

      // Trying to execute before timelock should fail
      try {
        await program.methods
          .executeAuthorityTransfer()
          .accounts({
            authority: authority.publicKey,
            tokenMint,
            config: configPda,
            pendingTransfer: pendingTransferPda,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown TimelockNotExpired error");
      } catch (err: any) {
        expect(err.message).to.include("TimelockNotExpired");
      }

      // Cancel the transfer instead of waiting 24 hours
      await program.methods
        .cancelAuthorityTransfer()
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          pendingTransfer: pendingTransferPda,
        })
        .signers([authority])
        .rpc();

      // Verify authority unchanged
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.authority.toBase58(), authority.publicKey.toBase58());
    });

    it("prevents non-authority from executing authority transfer", async () => {
      // Use the existing pending transfer from the previous test
      // (the cancel set cancelled=true but account still exists)
      const [pendingTransferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pending_authority_transfer"), configPda.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .executeAuthorityTransfer()
          .accounts({
            authority: user1.publicKey,
            tokenMint,
            config: configPda,
            pendingTransfer: pendingTransferPda,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown authority error");
      } catch (err: any) {
        // Anchor constraint errors may appear as "ConstraintHasOne" or custom error
        const isAuthError = err.message.includes("NotAuthority") ||
                           err.message.includes("ConstraintHasOne") ||
                           err.message.includes("has_one") ||
                           err.message.includes("A has one constraint") ||
                           err.message.includes("AuthorityTransferCancelled");
        expect(isAuthError).to.be.true;
      }
    });

    it("prevents non-authority from admin functions", async () => {
      try {
        await program.methods
          .setPaused(true)
          .accounts({
            authority: user1.publicKey,
            tokenMint,
            config: configPda,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.include("NotAuthority");
      }
    });

    it("prevents non-authority from cancelling authority transfer", async () => {
      // PDA already exists from "proposes authority transfer with timelock" test
      // which was cancelled, so we use the existing PDA
      const [pendingTransferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pending_authority_transfer"), configPda.toBuffer()],
        program.programId
      );

      // Non-authority tries to cancel the already-cancelled transfer
      // This should still fail with authority error
      try {
        await program.methods
          .cancelAuthorityTransfer()
          .accounts({
            authority: user1.publicKey,
            tokenMint,
            config: configPda,
            pendingTransfer: pendingTransferPda,
          })
          .signers([user1])
          .rpc();

        assert.fail("Should have thrown authority error");
      } catch (err: any) {
        const isAuthError = err.message.includes("NotAuthority") ||
                           err.message.includes("ConstraintHasOne") ||
                           err.message.includes("has_one") ||
                           err.message.includes("A has one constraint");
        expect(isAuthError).to.be.true;
      }
    });

    it("prevents executing a cancelled authority transfer", async () => {
      // PDA already exists from "proposes authority transfer with timelock" test
      // which was cancelled
      const [pendingTransferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pending_authority_transfer"), configPda.toBuffer()],
        program.programId
      );

      // Try to execute the already-cancelled transfer
      try {
        await program.methods
          .executeAuthorityTransfer()
          .accounts({
            authority: authority.publicKey,
            tokenMint,
            config: configPda,
            pendingTransfer: pendingTransferPda,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown AuthorityTransferCancelled error");
      } catch (err: any) {
        expect(err.message).to.include("AuthorityTransferCancelled");
      }
    });
  });

  describe("Airdrop Registration", () => {
    it("registers airdrop", async () => {
      const [airdropStatePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("airdrop"), configPda.toBuffer()],
        program.programId
      );

      const recipients = [user1.publicKey, user2.publicKey];
      const amountPerRecipient = new anchor.BN(1000 * 10 ** 9); // 1000 tokens each

      const tx = await program.methods
        .airdrop(recipients, amountPerRecipient)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          airdropState: airdropStatePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Airdrop registration tx:", tx);

      const airdropState = await program.account.airdropState.fetch(airdropStatePda);
      assert.equal(
        airdropState.totalAirdropped.toNumber(),
        amountPerRecipient.toNumber() * recipients.length
      );
      assert.equal(airdropState.recipientCount.toNumber(), recipients.length);
    });
  });

  describe("Fee Proposal Timelock", () => {
    let feeProposalPda: PublicKey;

    before(() => {
      [feeProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_proposal"), configPda.toBuffer()],
        program.programId
      );
    });

    it("proposes fee update with timelock", async () => {
      const newReflection = 300; // 3%
      const newLp = 100; // 1%
      const newBurn = 100; // 1%

      const tx = await program.methods
        .proposeFeeUpdate(newReflection, newLp, newBurn)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          feeProposal: feeProposalPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Fee proposal tx:", tx);

      // Verify proposal was created
      const proposal = await program.account.feeProposal.fetch(feeProposalPda);
      assert.equal(proposal.proposer.toBase58(), authority.publicKey.toBase58());
      assert.equal(proposal.reflectionShareBps, newReflection);
      assert.equal(proposal.lpShareBps, newLp);
      assert.equal(proposal.burnShareBps, newBurn);
      assert.equal(proposal.executed, false);
      assert.equal(proposal.cancelled, false);
    });

    it("fails to execute before timelock expires", async () => {
      try {
        await program.methods
          .executeFeeUpdate()
          .accounts({
            authority: authority.publicKey,
            tokenMint,
            config: configPda,
            feeProposal: feeProposalPda,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown TimelockNotExpired error");
      } catch (err: any) {
        expect(err.message).to.include("TimelockNotExpired");
      }
    });

    it("fails proposal with invalid fee total", async () => {
      // Create a new mint to test invalid proposal
      const newMint = await createMint(
        connection,
        authority,
        authority.publicKey,
        null,
        9,
        Keypair.generate(),
        { commitment: "confirmed" },
        TOKEN_2022_PROGRAM_ID
      );

      const [newConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("config"), newMint.toBuffer()],
        program.programId
      );

      const [newVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("staking_vault"), newMint.toBuffer()],
        program.programId
      );

      const [newPoolPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("reflection_pool"), newMint.toBuffer()],
        program.programId
      );

      const [newFeeProposalPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_proposal"), newConfigPda.toBuffer()],
        program.programId
      );

      // Initialize new config first
      await program.methods
        .initialize(200, 200, 100)
        .accounts({
          authority: authority.publicKey,
          tokenMint: newMint,
          stakingVault: newVaultPda,
          reflectionPool: newPoolPda,
          config: newConfigPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      try {
        await program.methods
          .proposeFeeUpdate(100, 100, 100) // Total 300, should be 500
          .accounts({
            authority: authority.publicKey,
            tokenMint: newMint,
            config: newConfigPda,
            feeProposal: newFeeProposalPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown InvalidFeeConfig error");
      } catch (err: any) {
        expect(err.message).to.include("InvalidFeeConfig");
      }
    });

    it("cancels fee proposal", async () => {
      const tx = await program.methods
        .cancelFeeProposal()
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          feeProposal: feeProposalPda,
        })
        .signers([authority])
        .rpc();

      console.log("Cancel fee proposal tx:", tx);

      // Verify proposal was cancelled
      const proposal = await program.account.feeProposal.fetch(feeProposalPda);
      assert.equal(proposal.cancelled, true);

      // Verify config unchanged
      const config = await program.account.kernelConfig.fetch(configPda);
      assert.equal(config.reflectionShareBps, REFLECTION_BPS);
      assert.equal(config.lpShareBps, LP_BPS);
      assert.equal(config.burnShareBps, BURN_BPS);
    });
  });

  describe("LP Vault Operations", () => {
    let lpVaultPda: PublicKey;
    let lpVaultTokenPda: PublicKey;
    const ALLOCATE_AMOUNT = new anchor.BN(10_000 * 10 ** 9); // 10K tokens

    before(() => {
      [lpVaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_vault"), tokenMint.toBuffer()],
        program.programId
      );

      [lpVaultTokenPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp_vault_token"), tokenMint.toBuffer()],
        program.programId
      );
    });

    it("initializes LP vault", async () => {
      const tx = await program.methods
        .initializeLpVault()
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          lpVault: lpVaultPda,
          lpVaultToken: lpVaultTokenPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Initialize LP vault tx:", tx);

      // Verify LP vault was created
      const lpVault = await program.account.lpVault.fetch(lpVaultPda);
      assert.equal(lpVault.authority.toBase58(), authority.publicKey.toBase58());
      assert.equal(lpVault.tokenMint.toBase58(), tokenMint.toBase58());
      assert.equal(lpVault.totalAllocated.toNumber(), 0);
      assert.equal(lpVault.totalDeployed.toNumber(), 0);
      assert.equal(lpVault.pendingDeployment.toNumber(), 0);
    });

    it("allocates tokens to LP vault", async () => {
      const balanceBefore = await getAccount(
        connection,
        authorityTokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const tx = await program.methods
        .allocateToLp(ALLOCATE_AMOUNT)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          lpVault: lpVaultPda,
          authorityTokenAccount,
          lpVaultToken: lpVaultTokenPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation and state propagation
      await connection.confirmTransaction(tx, "confirmed");
      console.log("Allocate to LP tx:", tx);

      // Verify LP vault updated
      const lpVault = await program.account.lpVault.fetch(lpVaultPda);
      assert.equal(lpVault.totalAllocated.toNumber(), ALLOCATE_AMOUNT.toNumber());
      assert.equal(lpVault.pendingDeployment.toNumber(), ALLOCATE_AMOUNT.toNumber());

      // Verify vault token balance
      const vaultBalance = await getAccount(
        connection,
        lpVaultTokenPda,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(Number(vaultBalance.amount), ALLOCATE_AMOUNT.toNumber());

      // Verify authority balance decreased
      const balanceAfter = await getAccount(
        connection,
        authorityTokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(balanceBefore.amount) - Number(balanceAfter.amount),
        ALLOCATE_AMOUNT.toNumber()
      );
    });

    it("fails to allocate zero amount", async () => {
      try {
        await program.methods
          .allocateToLp(new anchor.BN(0))
          .accounts({
            authority: authority.publicKey,
            tokenMint,
            config: configPda,
            lpVault: lpVaultPda,
            authorityTokenAccount,
            lpVaultToken: lpVaultTokenPda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown ZeroAmount error");
      } catch (err: any) {
        expect(err.message).to.include("ZeroAmount");
      }
    });

    it("records LP deployment", async () => {
      const deployAmount = new anchor.BN(5_000 * 10 ** 9); // Deploy 5K tokens
      const lpTokensReceived = new anchor.BN(1000 * 10 ** 9); // Mock LP tokens
      const poolAddress = Keypair.generate().publicKey;

      // Derive LP deployment PDA (uses total_deployed which is 0 before first deployment)
      const lpVaultBefore = await program.account.lpVault.fetch(lpVaultPda);
      const [lpDeploymentPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("lp_deployment"),
          lpVaultPda.toBuffer(),
          Buffer.from(lpVaultBefore.totalDeployed.toArray("le", 8)),
        ],
        program.programId
      );

      const tx = await program.methods
        .recordLpDeployment(deployAmount, lpTokensReceived, poolAddress)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          lpVault: lpVaultPda,
          lpDeployment: lpDeploymentPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc();

      console.log("Record LP deployment tx:", tx);

      // Verify LP vault updated
      const lpVault = await program.account.lpVault.fetch(lpVaultPda);
      assert.equal(lpVault.totalDeployed.toNumber(), deployAmount.toNumber());
      assert.equal(
        lpVault.pendingDeployment.toNumber(),
        ALLOCATE_AMOUNT.toNumber() - deployAmount.toNumber()
      );

      // Verify deployment record
      const deployment = await program.account.lpDeployment.fetch(lpDeploymentPda);
      assert.equal(deployment.poolAddress.toBase58(), poolAddress.toBase58());
      assert.equal(deployment.kernelAmount.toNumber(), deployAmount.toNumber());
      assert.equal(deployment.lpTokensReceived.toNumber(), lpTokensReceived.toNumber());
      assert.equal(deployment.withdrawn, false);
    });

    it("withdraws from LP vault", async () => {
      const withdrawAmount = new anchor.BN(2_000 * 10 ** 9); // Withdraw 2K tokens

      const balanceBefore = await getAccount(
        connection,
        authorityTokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const lpVaultBefore = await program.account.lpVault.fetch(lpVaultPda);

      const tx = await program.methods
        .withdrawFromLpVault(withdrawAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          lpVault: lpVaultPda,
          authorityTokenAccount,
          lpVaultToken: lpVaultTokenPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      // Wait for confirmation to ensure state propagation
      await connection.confirmTransaction(tx, "confirmed");

      console.log("Withdraw from LP vault tx:", tx);

      // Verify LP vault updated
      const lpVault = await program.account.lpVault.fetch(lpVaultPda);
      assert.equal(
        lpVault.pendingDeployment.toNumber(),
        lpVaultBefore.pendingDeployment.toNumber() - withdrawAmount.toNumber()
      );

      // Verify authority balance increased
      const balanceAfter = await getAccount(
        connection,
        authorityTokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );
      assert.equal(
        Number(balanceAfter.amount) - Number(balanceBefore.amount),
        withdrawAmount.toNumber()
      );
    });

    it("fails to withdraw more than pending", async () => {
      const lpVault = await program.account.lpVault.fetch(lpVaultPda);
      const tooMuch = new anchor.BN(lpVault.pendingDeployment.toNumber() + 1);

      try {
        await program.methods
          .withdrawFromLpVault(tooMuch)
          .accounts({
            authority: authority.publicKey,
            tokenMint,
            config: configPda,
            lpVault: lpVaultPda,
            authorityTokenAccount,
            lpVaultToken: lpVaultTokenPda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .signers([authority])
          .rpc();

        assert.fail("Should have thrown InsufficientLPFunds error");
      } catch (err: any) {
        expect(err.message).to.include("InsufficientLPFunds");
      }
    });
  });

  describe("Multi-User Reflections", () => {
    it("distributes reflections proportionally to multiple stakers", async () => {
      // User2 stakes tokens
      const user2StakeAmount = new anchor.BN(2_000_000 * 10 ** 9); // 2M tokens

      const [user2StakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user2.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .stake(user2StakeAmount)
        .accounts({
          owner: user2.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user2TokenAccount,
          stakingVault: stakingVaultPda,
          userStake: user2StakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user2])
        .rpc({ commitment: "confirmed" });

      console.log("User2 staked:", user2StakeAmount.toString());

      // Get stake amounts for proportion calculation
      const [user1StakePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), configPda.toBuffer(), user1.publicKey.toBuffer()],
        program.programId
      );

      const user1Stake = await program.account.userStake.fetch(user1StakePda);
      const user2Stake = await program.account.userStake.fetch(user2StakePda);

      console.log("User1 staked:", user1Stake.stakedAmount.toString());
      console.log("User2 staked:", user2Stake.stakedAmount.toString());

      // Deposit reflections
      const reflectionAmount = new anchor.BN(50_000 * 10 ** 9); // 50K tokens

      await program.methods
        .depositReflections(reflectionAmount)
        .accounts({
          authority: authority.publicKey,
          tokenMint,
          config: configPda,
          authorityTokenAccount,
          reflectionPool: reflectionPoolPda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([authority])
        .rpc({ commitment: "confirmed" });

      console.log("Deposited reflections:", reflectionAmount.toString());

      // Get balances before claims
      const user1BalanceBefore = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const user2BalanceBefore = await getAccount(
        connection,
        user2TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      // User1 claims
      await program.methods
        .claimReflections()
        .accounts({
          owner: user1.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user1TokenAccount,
          reflectionPool: reflectionPoolPda,
          userStake: user1StakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user1])
        .rpc({ commitment: "confirmed" });

      // User2 claims
      await program.methods
        .claimReflections()
        .accounts({
          owner: user2.publicKey,
          tokenMint,
          config: configPda,
          userTokenAccount: user2TokenAccount,
          reflectionPool: reflectionPoolPda,
          userStake: user2StakePda,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([user2])
        .rpc({ commitment: "confirmed" });

      // Get balances after claims
      const user1BalanceAfter = await getAccount(
        connection,
        user1TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const user2BalanceAfter = await getAccount(
        connection,
        user2TokenAccount,
        "confirmed",
        TOKEN_2022_PROGRAM_ID
      );

      const user1Rewards = Number(user1BalanceAfter.amount) - Number(user1BalanceBefore.amount);
      const user2Rewards = Number(user2BalanceAfter.amount) - Number(user2BalanceBefore.amount);

      console.log("User1 rewards:", user1Rewards);
      console.log("User2 rewards:", user2Rewards);

      // Both users should have received rewards
      assert.isTrue(user1Rewards > 0, "User1 should receive rewards");
      assert.isTrue(user2Rewards > 0, "User2 should receive rewards");

      // User2 staked more, should receive more rewards
      // User2 has 2M, proportionally more than user1's remaining stake
      const totalStaked = user1Stake.stakedAmount.toNumber() + user2Stake.stakedAmount.toNumber();
      const expectedUser2Proportion = user2Stake.stakedAmount.toNumber() / totalStaked;

      // User2's rewards should be proportional to their stake (with some tolerance for rounding)
      const actualUser2Proportion = user2Rewards / (user1Rewards + user2Rewards);
      const tolerance = 0.05; // 5% tolerance for rounding

      assert.approximately(
        actualUser2Proportion,
        expectedUser2Proportion,
        tolerance,
        "Rewards should be distributed proportionally"
      );
    });
  });
});
