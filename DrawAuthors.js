function simulate(data, svg) {
    let width = 800, height = 600; // Fallback dimensions
    let viewBox = svg.attr("viewBox");
    if (viewBox) {
        let parts = viewBox.split(" ").map(Number);
        width = parts[2];
        height = parts[3];
    }
    
    var tooltip = d3.select("body")
        .append("div")
        .style("visibility", "hidden")
        .style("position", "absolute")
        .style("background", "white")
        .style("padding", "8px")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "12px");

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
            const sharedTitles = nodes[i].titles.filter(title => nodes[j].titles.includes(title));
            if (sharedTitles.length > 0) {
                links.push({
                    source: i,
                    target: j,
                    value: sharedTitles.length
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

    // Helper for countries extraction
    const getCountries = (node) => {
        let cList = node.Countries || node.countries || [];
        if (typeof cList === "string") cList = [cList];
        return cList.map(c => String(c).trim().toLowerCase());
    };

    // 4. Render link elements inside the centered group
    let link_elements = main_group.append("g")
        .selectAll(".line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .style("stroke-width", (d) => d.value);

    // 5. Render node elements directly inside main_group (removed faulty inner group & transform)
    let node_elements = main_group.append("g")
        .selectAll(".circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", (d, i) => scale_radius(node_degree[i]))
        .attr("fill", (d) => color(d.group))
        .on("mouseover", function(event, hovered) {
            // D3 v5 passes the datum as the first argument, while v6+ passes it second.
            if (hovered === undefined) hovered = event;
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
        .on("click", function(event) {
            event.stopPropagation(); // Prevent triggering background click
            const clickedNode = this.__data__;
            const countriesArray = getCountries(clickedNode);

            tooltip.style("visibility", "visible")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`)
                .html(`<strong>Author:</strong> ${clickedNode.id}<br/><strong>Countries:</strong> ${countriesArray.join(", ") || "N/A"}<br/><strong>Years:</strong> ${clickedNode.years.join(", ")}`);
        });

    // Clicking on empty SVG background or outside the SVG hides the tooltip
    svg.on("click", function() {
        tooltip.style("visibility", "hidden");
    });

    window.addEventListener("click", function() {
        tooltip.style("visibility", "hidden");
    });

    // 6. Force Simulation setup
    let ForceSimulation = d3.forceSimulation(nodes)
        .force(
            "collide",
            d3.forceCollide().radius((d) => scale_radius(node_degree[d.index]) * 4),
        )
        .force("x", d3.forceX().strength(0.1))
        .force("y", d3.forceY().strength(0.1))
        .force("charge", d3.forceManyBody().strength(-30))
        .force("link", d3.forceLink(links).id((d) => d.index))
        .on("tick", ticked);

    // The previous code only attached listeners to selectors; it never
    // created the slider elements, so nothing was visible on the page.
    const controls = d3.select("body").append("div")
        .attr("class", "simulation-controls")
        .style("position", "fixed")
        .style("top", "12px")
        .style("right", "12px")
        .style("z-index", "1000")
        .style("padding", "10px")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("font", "12px sans-serif");

    function addSlider(id, label, min, max, initial, step, update) {
        const row = controls.append("label")
            .style("display", "block")
            .style("margin", "4px 0");
        row.append("span").text(`${label}: `);
        const output = row.append("span").text(initial);
        row.append("input")
            .attr("id", id)
            .attr("type", "range")
            .attr("min", min)
            .attr("max", max)
            .attr("step", step)
            .property("value", initial)
            .style("display", "block")
            .on("input", function() {
                const value = +this.value;
                output.text(value);
                update(value);
                ForceSimulation.alpha(0.3).restart();
            });
    }

    addSlider("charge-slider", "Charge", -200, 0, -30, 1, (value) => {
        ForceSimulation.force("charge").strength(value);
    });
    addSlider("collide-slider", "Collision", 0, 10, 4, 0.1, (value) => {
        ForceSimulation.force("collide").radius((d) => scale_radius(node_degree[d.index]) * value);
    });
    addSlider("link-strength", "Link strength", 0, 2, 1, 0.1, (value) => {
        ForceSimulation.force("link").strength(value);
    });
        
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
