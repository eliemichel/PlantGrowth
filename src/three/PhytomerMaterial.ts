import {
    MeshStandardMaterial,
    MeshStandardMaterialParameters,
    MathUtils,
} from 'three';

const vertexShaderInjections = [
    {
        section: 'common',
        content: /* glsl */`
        mat4 mixMat4(mat4 a, mat4 b, float t) {
            return mat4(
                mix(a[0], b[0], t),
                mix(a[1], b[1], t),
                mix(a[2], b[2], t),
                mix(a[3], b[3], t)
            );
        }

        // Transform matrix of the parent (combined transform + thickness)
        attribute mat4 transformBegin;

        // Transform matrix of the phytomer's node (combined transform + thickness)
        attribute mat4 transformEnd;

        varying vec2 vUv;
        `,
    },
    {
        section: 'color_vertex',
        content: /* glsl */`
        // Global init
        mat4 transform = mixMat4(transformBegin, transformEnd, position.z);
        `,
    },
    {
        section: 'begin_vertex',
        content: /* glsl */`
        vUv = transformed.yz;
        transformed.y = sin(2.0 * PI * vUv.x);
        transformed.z = 0.0;
        transformed = (transform * vec4(transformed, 1.0)).xyz;
        `,
    },
    {
        section: 'beginnormal_vertex',
        content: /* glsl */`
        objectNormal = mat3(transform) * objectNormal;
        `,
    },
]

const fragmentShaderInjections = [
    {
        section: 'common',
        content: /* glsl */`
        varying vec2 vUv;
        `,
    },
    {
        section: 'color_fragment',
        content: /* glsl */`
        vec2 cellCount = vec2(8.0, 30.0);
        vec2 subUv = fract(vUv * cellCount);
        vec3 dotColor = diffuseColor.rgb * 1.2;
        float fac = step(length(subUv - 0.5), 0.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, dotColor, fac);
        `,
    },
]

export default class PhytomerMaterial extends MeshStandardMaterial {
    static key = MathUtils.generateUUID() + "1"; // change for hot-reloading

    uniforms = {
        time: { value: 0.0 },
        instanceCount: { value: 10 },
        windAmplitude: { value: 0.1 },
        windDirectionAngle: { value: 0.1 },
        windInverseSpeed: { value: 0.1 },
        windTurbulence: { value: 0.5 },
    };

    uniformsGroups = [];

    constructor(opts: MeshStandardMaterialParameters) {
        super(opts);

        this.onBeforeCompile = (shader) => {
            // Patching from https://github.com/mrdoob/three.js/blob/dev/src/renderers/shaders/ShaderLib/meshphysical.glsl.js
            for (const [key, entry] of Object.entries(this.uniforms)) {
                shader.uniforms[key] = entry;
            }

            for (const injection of vertexShaderInjections) {
                shader.vertexShader = shader.vertexShader.replace(
                    `#include <${injection.section}>`,
                    `#include <${injection.section}>
                    ${injection.content}
                    `
                )
            }

            for (const injection of fragmentShaderInjections) {
                shader.fragmentShader = shader.fragmentShader.replace(
                    `#include <${injection.section}>`,
                    `#include <${injection.section}>
                    ${injection.content}
                    `
                )
            }
        };
    }
}
