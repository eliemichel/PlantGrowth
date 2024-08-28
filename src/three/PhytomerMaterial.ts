import {
    MeshStandardMaterial,
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

        // Transform matrix of the parent
        attribute mat4 transformBegin;

        // Transform matrix of the phytomer's node
        attribute mat4 transformEnd;
        `,
    },
    {
        section: 'color_vertex',
        content: /* glsl */`
        mat4 transform = mixMat4(transformBegin, transformEnd, position.z);
        float radius = 0.005;
        `,
    },
    {
        section: 'begin_vertex',
        content: /* glsl */`
        transformed.xy *= radius;
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

export default class PhytomerMaterial extends MeshStandardMaterial {
    static key = MathUtils.generateUUID() // for hot-reloading

    uniforms = {
        time: { value: 0.0 },
        instanceCount: { value: 10 },
        windAmplitude: { value: 0.1 },
        windDirectionAngle: { value: 0.1 },
        windInverseSpeed: { value: 0.1 },
        windTurbulence: { value: 0.5 },
    };

    uniformsGroups = [];

    constructor(opts: any) {
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
        };
    }
}
