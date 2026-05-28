package com.rhemery.logistica.ore;

import java.util.LinkedHashMap;
import java.util.Map;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.Mth;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.core.Holder;
import net.minecraft.world.level.levelgen.Heightmap;

public final class OreFieldGenerator {
    public static final OreFieldGenerator INSTANCE = new OreFieldGenerator();

    private OreFieldGenerator() {}

    public OreChunkData generate(ServerLevel level, ChunkPos chunkPos) {
        int centerX = chunkPos.getMinBlockX() + 8;
        int centerZ = chunkPos.getMinBlockZ() + 8;
        int centerY = level.getHeight(Heightmap.Types.WORLD_SURFACE, centerX, centerZ);
        Holder<Biome> biome = level.getBiome(new BlockPos(centerX, centerY, centerZ));

        long levelSeed = level.getSeed();
        Map<net.minecraft.resources.ResourceLocation, Float> generated = new LinkedHashMap<>();

        for (OreMaterialDefinition material : OreMaterialRegistry.all()) {
            float biomeModifier = material.biomeModifier(biome);
            float chance = Mth.clamp(material.baseChance() * biomeModifier, 0.0F, 1.0F);
            if (chance <= 0.0F) {
                continue;
            }

            double primaryNoise = fractalNoise(levelSeed ^ material.id().hashCode(), chunkPos.x, chunkPos.z, material.noiseScale(), 3);
            double secondaryNoise = fractalNoise(levelSeed + material.id().hashCode() * 31L, chunkPos.x + 19.531, chunkPos.z - 11.171,
                    material.noiseScale() * 2.15F, 2);
            double combined = Mth.clamp(primaryNoise * 0.78D + secondaryNoise * 0.22D, 0.0D, 1.0D);

            double threshold = 1.0D - chance;
            if (combined <= threshold) {
                continue;
            }

            double normalized = (combined - threshold) / Math.max(0.0001D, 1.0D - threshold);
            float richness = (float) Math.pow(normalized, material.noisePower());
            float saturation = Mth.clamp(richness * material.maxSaturation(), 0.0F, material.maxSaturation());
            if (saturation > 0.005F) {
                generated.put(material.id(), saturation);
            }
        }

        return new OreChunkData(generated);
    }

    private double fractalNoise(long seed, double x, double z, double scale, int octaves) {
        double total = 0.0D;
        double amplitude = 1.0D;
        double frequency = scale;
        double maxAmplitude = 0.0D;

        for (int i = 0; i < octaves; i++) {
            double sample = valueNoise(seed + (i * 0x9E3779B97F4A7C15L), x * frequency, z * frequency);
            total += sample * amplitude;
            maxAmplitude += amplitude;
            amplitude *= 0.5D;
            frequency *= 2.0D;
        }

        return total / Math.max(0.00001D, maxAmplitude);
    }

    private double valueNoise(long seed, double x, double z) {
        int x0 = Mth.floor(x);
        int z0 = Mth.floor(z);
        int x1 = x0 + 1;
        int z1 = z0 + 1;

        double tx = x - x0;
        double tz = z - z0;
        double sx = smoothstep(tx);
        double sz = smoothstep(tz);

        double n00 = hash01(seed, x0, z0);
        double n10 = hash01(seed, x1, z0);
        double n01 = hash01(seed, x0, z1);
        double n11 = hash01(seed, x1, z1);

        double nx0 = lerp(n00, n10, sx);
        double nx1 = lerp(n01, n11, sx);
        return lerp(nx0, nx1, sz);
    }

    private double hash01(long seed, int x, int z) {
        long h = seed;
        h ^= 0x9E3779B97F4A7C15L * x;
        h ^= 0xC2B2AE3D27D4EB4FL * z;
        h ^= (h >>> 30);
        h *= 0xBF58476D1CE4E5B9L;
        h ^= (h >>> 27);
        h *= 0x94D049BB133111EBL;
        h ^= (h >>> 31);
        return (h & 0x7FFFFFFFFFFFFFFFL) / (double) Long.MAX_VALUE;
    }

    private static double lerp(double a, double b, double t) {
        return a + (b - a) * t;
    }

    private static double smoothstep(double value) {
        return value * value * (3.0D - 2.0D * value);
    }
}
