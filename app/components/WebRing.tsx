'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const getConfig = (nodeCount: number = 1) => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    const fg = '#c1c1c1';
    const accent = '#fbcb97';
    const line = '#252530';
    const visual = '#333333';

    const minScale = 0.5;
    const maxScale = 2;

    return {
        backgroundColor: bg,
        node: {
            radius: 8,
            fillColor: visual,
            hoverColor: accent,
        },
        link: {
            stroke: line,
            strokeWidth: 1,
        },
        label: {
            fontSize: '12px',
            fontFamily: 'Iosevka, monospace',
            fillColor: fg,
            offsetY: -16,
        },
        forces: {
            alphaDecay: 0.02,
            velocityDecay: 0.3,
            link: {
                distance: 70,
                strength: 0.6,
            },
            charge: {
                strength: -200,
                distanceMax: 600,
            },
            collision: {
                radius: 20,
                strength: 0.4,
                iterations: 2,
            },
            center: {
                strength: 0.01,
            },
        },
        transitions: {
            hoverDuration: 200,
            initialZoomDuration: 800,
            panDuration: 400,
        },
        zoom: {
            minScale: minScale,
            maxScale: maxScale,
        },
        initialization: {
            radius: 1 / 3,
        },
    } as const;
};

interface Site extends d3.SimulationNodeDatum {
    website: string;
    name: string;
    id?: string;
    program: string;
    year: number;
}

interface WebringData {
    sites: Site[];
}

type SortField = 'name' | 'program' | 'year';
type SortDirection = 'asc' | 'desc';

export function WebRing({
    webringData,
    hoveredSite,
    hoveredProgram,
    sortField,
    sortDirection
}: {
    webringData: WebringData;
    hoveredSite: string | null;
    hoveredProgram: string | null;
    sortField?: SortField;
    sortDirection?: SortDirection;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current || !webringData?.sites.length) return;

        const conf = getConfig(webringData.sites.length);
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        d3.select(container).selectAll('*').remove();

        const svg = d3
            .select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .style('background-color', conf.backgroundColor);

        const g = svg.append('g');

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([conf.zoom.minScale, conf.zoom.maxScale])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                const { x, y, k } = event.transform;
                g.attr('transform', `translate(${x},${y}) scale(${k})`);
            });

        svg.call(zoom);

        const sortedSites = [...webringData.sites].sort((a, b) => {
            let aValue: string | number = '';
            let bValue: string | number = '';

            switch (sortField) {
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'program':
                    aValue = a.program.toLowerCase();
                    bValue = b.program.toLowerCase();
                    break;
                case 'year':
                    aValue = a.year;
                    bValue = b.year;
                    break;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else {
                return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
            }
        });

        sortedSites.forEach((site, index) => {
            site.id = `node-${index}`;
            site.x = Math.random() * width;
            site.y = Math.random() * height;
        });

        const links = sortedSites.map((site, index) => ({
            source: site.id!,
            target: sortedSites[(index + 1) % sortedSites.length].id!,
        }));

        const simulation = d3
            .forceSimulation(sortedSites)
            .alphaDecay(conf.forces.alphaDecay)
            .velocityDecay(conf.forces.velocityDecay)
            .force(
                'link',
                d3
                    .forceLink<Site, d3.SimulationLinkDatum<Site>>(links)
                    .id((d) => d.id!)
                    .distance(conf.forces.link.distance)
                    .strength(conf.forces.link.strength)
            )
            .force('charge', d3.forceManyBody()
                .strength(conf.forces.charge.strength)
                .distanceMax(conf.forces.charge.distanceMax)
            )
            .force('collision', d3.forceCollide()
                .radius(conf.forces.collision.radius)
                .strength(conf.forces.collision.strength)
                .iterations(conf.forces.collision.iterations)
            )
            .force('center', d3.forceCenter(width / 2, height / 2)
                .strength(conf.forces.center.strength)
            );

        const link = g
            .append('g')
            .selectAll<SVGLineElement, d3.SimulationLinkDatum<Site>>('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', conf.link.stroke)
            .attr('stroke-width', conf.link.strokeWidth);

        const node = g
            .append('g')
            .selectAll<SVGCircleElement, Site>('circle')
            .data(sortedSites)
            .enter()
            .append('circle')
            .attr('r', conf.node.radius)
            .attr('fill', conf.node.fillColor)
            .attr('cursor', 'pointer')
            .call(
                d3
                    .drag<SVGCircleElement, Site>()
                    .on('start', dragstart)
                    .on('drag', dragging)
                    .on('end', dragend)
            )
            .on('click', (_event: MouseEvent, d: Site) =>
                window.open(d.website, '_blank')
            )
            .on('mouseenter', function() {
                d3.select(this).transition().duration(conf.transitions.hoverDuration).attr('fill', conf.node.hoverColor);
            })
            .on('mouseleave', function() {
                d3.select(this).transition().duration(conf.transitions.hoverDuration).attr('fill', conf.node.fillColor);
            });

        const labels = g
            .append('g')
            .selectAll<SVGTextElement, Site>('text')
            .data(sortedSites)
            .enter()
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', conf.label.fontSize)
            .attr('font-family', conf.label.fontFamily)
            .attr('fill', conf.label.fillColor)
            .attr('pointer-events', 'none')
            .text((d) => d.name);

        let simulationEnded = false;
        let initialZoomApplied = true;
        let frameScheduled = false;

        const updateDOM = () => {
            frameScheduled = false;

            link
                .attr('x1', (d: any) => d.source.x)
                .attr('y1', (d: any) => d.source.y)
                .attr('x2', (d: any) => d.target.x)
                .attr('y2', (d: any) => d.target.y);

            node
                .attr('cx', (d: any) => d.x)
                .attr('cy', (d: any) => d.y);

            labels
                .attr('x', (d: any) => d.x)
                .attr('y', (d: any) => d.y + conf.label.offsetY);

            if (!initialZoomApplied && simulation.alpha() < 0.5) {
                initialZoomApplied = true;
                const initialScale = Math.max(0.1, 1 / Math.sqrt(webringData.sites.length / 20));
                const initialTransform = d3.zoomIdentity
                    .translate(width / 2, height / 2)
                    .scale(initialScale)
                    .translate(-width / 2, -height / 2);
                svg
                    .transition()
                    .duration(conf.transitions.initialZoomDuration)
                    .ease(d3.easeCubicInOut)
                    .call(zoom.transform as any, initialTransform);
            }

            if (simulation.alpha() < 0.1 && !simulationEnded) {
                simulationEnded = true;

                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                sortedSites.forEach((d: any) => {
                    minX = Math.min(minX, d.x - conf.node.radius);
                    maxX = Math.max(maxX, d.x + conf.node.radius);
                    minY = Math.min(minY, d.y - conf.node.radius);
                    maxY = Math.max(maxY, d.y + conf.node.radius);
                });
            }
        };

        simulation.on('tick', () => {
            if (!frameScheduled) {
                frameScheduled = true;
                requestAnimationFrame(updateDOM);
            }
        });

        function dragstart(
            event: d3.D3DragEvent<SVGCircleElement, Site, any>
        ) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragging(event: d3.D3DragEvent<SVGCircleElement, Site, any>) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragend(event: d3.D3DragEvent<SVGCircleElement, Site, any>) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = undefined;
            event.subject.fy = undefined;
        }
    }, [webringData, sortField, sortDirection]);

    useEffect(() => {
        if (!containerRef.current) return;

        const conf = getConfig(webringData.sites.length);
        const node = d3.select(containerRef.current).selectAll<SVGCircleElement, Site>('circle');

        node.transition()
            .duration(conf.transitions.hoverDuration)
            .attr('fill', (d: Site) =>
                hoveredProgram === d.program || hoveredSite === d.name ? conf.node.hoverColor : conf.node.fillColor
            );
    }, [hoveredProgram, hoveredSite]);

    return <div ref={containerRef} className="w-full h-screen" />;
}
