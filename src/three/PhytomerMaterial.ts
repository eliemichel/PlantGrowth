import {
    MeshStandardMaterial,
    MathUtils,
} from 'three';

const vertexShaderInjections = [
    {
        section: 'common',
        content: `

        `,
    },
    {
        section: 'color_vertex',
        content: '',
    },
    {
        section: 'begin_vertex',
        content: `
        transformed.xy *= 0.1;
        transformed.y += 1.5;
        `,
    },
    {
        section: 'beginnormal_vertex',
        content: '',
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
