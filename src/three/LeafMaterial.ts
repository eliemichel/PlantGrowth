import {
    MeshStandardMaterial,
    MeshStandardMaterialParameters,
    MathUtils,
} from 'three';

const vertexShaderInjections = [
    {
        section: 'common',
        content: /* glsl */`
        `,
    },
    {
        section: 'color_vertex',
        content: /* glsl */`
        `,
    },
    {
        section: 'begin_vertex',
        content: /* glsl */`
        `,
    },
    {
        section: 'beginnormal_vertex',
        content: /* glsl */`
        `,
    },
]

export default class PhytomerMaterial extends MeshStandardMaterial {
    static key = MathUtils.generateUUID() // for hot-reloading

    uniforms = {
        time: { value: 0.0 },
    };

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
        };
    }
}
