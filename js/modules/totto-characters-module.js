import { openStoryModal } from './shared/story-modal.js';

async function ensureCytoscape() {
    if (window.cytoscape) return;

    const src = new URL('../lib/cytoscape.min.js', import.meta.url).href;
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load cytoscape'));
        document.head.appendChild(script);
    });
}

function getCssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function getRoleName(role) {
    const map = {
        student: '巴学园学生',
        principal: '校长',
        parent: '家长',
        location: '地点'
    };
    return map[role] || role || '角色';
}

function getCharacterDesc(id) {
    const descs = {
        totto: '本书主角，一个充满好奇心、天真烂漫的小女孩。在巴学园，她找到了自信和快乐，学会了关心他人。',
        kobayashi: '巴学园的创办者，一位伟大的教育家。他尊重每个孩子的个性，用爱心和耐心培育孩子们成长。',
        mama: '小豆豆的母亲，温柔而坚定。她理解并支持小林校长的教育理念，是小豆豆坚强的后盾。',
        yasuaki: '小豆豆的好朋友，虽然患有小儿麻痹症，但在巴学园里，他和大家一样快乐地生活。',
        takahashi: '身体有些残疾的男孩，但在运动会上凭借小林校长的精心设计获得了冠军，找回了自信。',
        train: '由退役电车改造而成的教室，是巴学园最独特的标志，承载了孩子们的快乐时光。'
    };
    return descs[id] || '巴学园的一员。';
}

function showCharacterModal(nodeData) {
    openStoryModal({
        html: `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
        <img src="${nodeData.avatar}" alt="${nodeData.name}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid ${nodeData.color || '#ddd'};">
        <div>
          <h3 style="margin:0 0 0.25rem;">${nodeData.name || ''}</h3>
          <p style="margin:0;color:var(--text-secondary);">${getRoleName(nodeData.role)}</p>
        </div>
      </div>
      <p style="margin:0;line-height:1.8;color:var(--text-primary);">${getCharacterDesc(nodeData.id)}</p>
    `
    });
}

function buildNodes(data, resolvePath) {
    const source = Array.isArray(data.nodes) ? data.nodes : [];
    return source.map(node => {
        const d = node?.data || {};
        return {
            data: {
                id: d.id,
                name: d.name,
                role: d.role,
                color: d.color,
                avatar: resolvePath(d.avatar || '')
            }
        };
    });
}

function buildEdges(data) {
    const source = Array.isArray(data.edges) ? data.edges : [];
    return source.map(edge => ({ data: edge?.data || {} }));
}

export default {
    async render(ctx) {
        await ensureCytoscape();
        const dataPath = ctx.module.data || 'characters.json';
        const data = await ctx.fetchJSON(dataPath);
        const palette = {
            textPrimary: getCssVar('--text-primary', '#4A3728'),
            textSecondary: getCssVar('--text-secondary', '#7D6B5D'),
            bgPrimary: getCssVar('--bg-primary', '#FFFBF5')
        };

        ctx.panelEl.innerHTML = `
          <div class="panel-header">
            <h2>👥 人物图谱</h2>
            <p class="panel-desc">认识巴学园的人们</p>
          </div>
          <div class="characters-container">
            <div id="characterGraph"></div>
          </div>
        `;

        const cy = cytoscape({
            container: ctx.panelEl.querySelector('#characterGraph'),
            elements: {
                nodes: buildNodes(data, ctx.resolvePath),
                edges: buildEdges(data)
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'background-image': 'data(avatar)',
                        'background-fit': 'cover',
                        'background-clip': 'node',
                        width: 70,
                        height: 70,
                        'border-width': 4,
                        'border-color': '#ffffff',
                        'overlay-opacity': 0,
                        label: 'data(name)',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 8,
                        'font-size': '13px',
                        'font-weight': 'bold',
                        'font-family': 'Noto Sans SC, sans-serif',
                        color: palette.textPrimary,
                        'text-background-color': palette.bgPrimary,
                        'text-background-opacity': 0.9,
                        'text-background-padding': '3px',
                        'text-background-shape': 'roundrectangle'
                    }
                },
                {
                    selector: 'node[role = "location"]',
                    style: {
                        shape: 'round-rectangle',
                        width: 86,
                        height: 56,
                        'border-style': 'dashed',
                        'border-color': '#A89888'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2.5,
                        'line-color': '#D0C8C0',
                        'target-arrow-color': '#D0C8C0',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1.1,
                        'curve-style': 'bezier',
                        label: 'data(label)',
                        'font-size': '11px',
                        'font-family': 'Noto Sans SC, sans-serif',
                        color: palette.textSecondary,
                        'text-rotation': 'autorotate',
                        'text-background-color': palette.bgPrimary,
                        'text-background-opacity': 0.95,
                        'text-background-padding': 3,
                        'text-margin-y': -10
                    }
                },
                {
                    selector: 'edge[label = "友谊"]',
                    style: {
                        'line-color': '#F8BBD9',
                        'target-arrow-color': '#F8BBD9',
                        'target-arrow-shape': 'none',
                        width: 3
                    }
                },
                {
                    selector: ':selected',
                    style: {
                        'border-width': 5,
                        'border-color': '#FFD93D',
                        'line-color': '#FFD93D',
                        'target-arrow-color': '#FFD93D'
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 600,
                padding: 48,
                nodeRepulsion: 8000,
                idealEdgeLength: 120,
                gravity: 0.3,
                fit: true
            },
            minZoom: 0.5,
            maxZoom: 2.2,
            wheelSensitivity: 0.15,
            boxSelectionEnabled: false
        });

        cy.on('tap', 'node', (evt) => {
            showCharacterModal(evt.target.data());
        });

        ctx.state = ctx.state || {};
        ctx.state.cy = cy;
    },

    async destroy(ctx) {
        if (ctx.state?.cy) {
            ctx.state.cy.destroy();
            ctx.state.cy = null;
        }
    }
};
