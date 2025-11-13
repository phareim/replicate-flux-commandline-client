/**
 * LoRA (Low-Rank Adaptation) definitions and utilities for Fal.ai
 */

export const loraNames = {
    disney: {
        url: "https://civitai.com/api/download/models/825954?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "DisneyRenstyle",
    },
    lucid: {
        url: "https://civitai.com/api/download/models/857586?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Lucid Dream",
    },
    retrowave: {
        url: "https://civitai.com/api/download/models/913440?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "ck-rw, in the style of ck-rw,",
    },
    incase: {
        url: "https://civitai.com/api/download/models/857267?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Incase art",
    },
    eldritch: {
        url: "https://civitai.com/api/download/models/792184?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Eldritch Comic",
    },
    details_alt: {
        url: "https://civitai.com/api/download/models/839689?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    details: {
        url: "https://civitai.com/api/download/models/955535?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "aidmafluxpro1.1",
    },
    details_strong: {
        url: "https://civitai.com/api/download/models/839637?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    mj: {
        url: "https://civitai.com/api/download/models/827351?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "aidmaMJ6.1",
    },
    fantasy: {
        url: "https://civitai.com/api/download/models/880134?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    poly: {
        url: "https://civitai.com/api/download/models/812320?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "",
    },
    cinematic: {
        url: "https://civitai.com/api/download/models/857668?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "cinematic, cinematic still image, ",
    },
    "anime-flat": {
        url: "https://civitai.com/api/download/models/838667?type=Model&format=SafeTensor",
        scale: "2",
        keyword: "Flat colour anime style image showing",
    },
    anime: {
        url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "MythAn1m3, ",
    },
    "anime-portrait": {
        url: "https://civitai.com/api/download/models/753053?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "MythP0rt, ",
    },
    niji: {
        url: "https://civitai.com/api/download/models/855516?type=Model&format=SafeTensor",
        scale: "0.9",
        keyword: "aidmanijiv6, ",
    },
    "fantasy-core": {
        url: "https://civitai.com/api/download/models/905789?type=Model&format=SafeTensor",
        scale: "1",
        keyword:
            "This is a highly detailed, CGI-rendered digital artwork depicting a ",
    },
    goofy: {
        url: "https://civitai.com/api/download/models/830009?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "3d render, ",
    },
    psychedelic: {
        url: "https://civitai.com/api/download/models/983116?type=Model&format=SafeTensor",
        scale: "0.6",
        keyword: "ArsMovieStill, movie still from a 60s psychedelic movie, ",
    },
    neurocore: {
        url: "https://civitai.com/api/download/models/1010560?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "A digital artwork in the style of cknc, ",
    },
    "anime-realistic": {
        url: "https://civitai.com/api/download/models/1023735?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "Realistic anime style, ",
    },
    "comic-realistic": {
        url: "https://civitai.com/api/download/models/2321629?type=Model&format=SafeTensor",
        scale: "1",
        keyword: "pingtu style、illustration-fen, ",
    },
};

/**
 * Prepare LoRA objects for API submission
 * @param {Array} loraObjects - Array of LoRA objects with url, scale, and keyword
 * @param {string} scale - Default scale value if not specified in LoRA object
 * @returns {Object|null} - Object with loras array and loraKeywords string, or null if no LoRAs
 */
export function prepareLoras(loraObjects, scale) {
    if (!loraObjects || loraObjects.length === 0) return null;

    const loras = loraObjects.map((loraObj) => ({
        path: loraObj.url,
        scale: loraObj.scale || scale,
    }));

    const loraKeywords = loraObjects
        .map((loraObj) => loraObj.keyword)
        .filter(Boolean)
        .join(". ");

    return { loras, loraKeywords };
}
