function simulate(data, svg) {
    let width = 800, height = 600; // Fallback dimensions
    let viewBox = svg.attr("viewBox");
    if (viewBox) {
        let parts = viewBox.split(" ").map(Number);
        width = parts[2];
        height = parts[3];
    }

    // 1. Transform raw author nodes and generate links based on shared titles
    const rawNodes = Array.isArray(data) ? data : (data.nodes || []);
    
    const nodes = rawNodes.map((d, i) => ({
        index: i,
        id: d.id,
        titles: d.Titles || [],
        years: d.Years || [],
        sources: d.Source_titles || [],
        countries: d.Countries || [],
        affiliations: d.Affiliations || d.Affiliation || d.affiliations || d.affiliation || [],
        group: d.Years && d.Years.length ? Math.max(...d.Years) : 2020
    }));

    const links = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            // Find shared publication titles between two authors
            const sharedTitles = nodes[i].titles.filter(title => nodes[j].titles.includes(title));
            if (sharedTitles.length > 0) {
                links.push({
                    source: i,
                    target: j,
                    value: sharedTitles.length // Weight based on how many titles they share
                });
            }
        }
    }

    // 2. Calculate degree of the nodes
    let node_degree = {};
    nodes.forEach((d, i) => { node_degree[i] = 0; });
    links.forEach((d) => {
        const source = typeof d.source === "object" ? d.source.index : d.source;
        const target = typeof d.target === "object" ? d.target.index : d.target;
        if (source !== undefined && node_degree[source] !== undefined) node_degree[source]++;
        if (target !== undefined && node_degree[target] !== undefined) node_degree[target]++;
    });

    let degreesArray = Object.values(node_degree);
    let scale_radius = d3.scaleLinear()
        .domain(d3.extent(degreesArray.length ? degreesArray : [0, 1]))
        .range([3, 12]);

    let color = d3.scaleSequential()
        .domain([1995, 2020])
        .interpolator(d3.interpolateViridis);

    // 3. Create a single main group centered in the SVG viewport
    let main_group = svg.append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    const treatAuthorsClass=(Author)=>{
        let temp=Author.toString().split(' ').join('');
        temp = temp.split("."),join('');
        temp = temp.split(","),join('');
        temp = temp.split("/"),join('');
        return "gr" + temp
    }
    // 4. Render link elements inside the centered group
    let link_elements = main_group.append("g")
        .selectAll(".line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .style("stroke-width", (d) => d.value);

    // 5. Render node elements inside the centered group
    let node_elements = main_group.append("g")
        .attr('transform', 'translate(${(width/2), ${height / 2})')
        .selectAll(".circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", (d, i) => scale_radius(node_degree[i]))
        .attr("fill", (d) => color(d.group))
        .on("mouseover", function() {
            const hovered = this.__data__;
            
            const getCountries = (node) => {
                let cList = node.Countries || node.countries || [];
                if (typeof cList === "string") cList = [cList];
                return cList.map(c => String(c).trim().toLowerCase());
            };

            const hoveredCountries = new Set(getCountries(hovered));

        // Highlight nodes that share at least one country with the hovered node
            node_elements.style("opacity", (author) => {
                if (author === hovered) return 1;
                const authorCountries = getCountries(author);
                const sharesCountry = authorCountries.some(country => hoveredCountries.has(country));
                return sharesCountry ? 1 : 0.2;
            });
        })
            .on("mouseout", function() {
                node_elements.style("opacity", null);
        })

    // 6. Force Simulation setup
    let ForceSimulation = d3.forceSimulation(nodes)
        .force(
            "collide",
            d3.forceCollide().radius((d) => scale_radius(node_degree[d.index]) * 4),
        )
        .force("x", d3.forceX().strength(0.1))
        .force("y", d3.forceY().strength(0.1))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("link", d3.forceLink(links).id((d) => d.index),
        )
        .on("tick", ticked);

    function ticked() {
        node_elements
            .attr("cx", (d) => d.x)
            .attr("cy", (d) => d.y);

        link_elements
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);
    }
}