// midpoint rooting

//----------------------------------------------------------------------------------------
Tree.prototype.FirstDescendant = function(p) {
	this.curnode = p.child;
	return this.curnode;
}

//----------------------------------------------------------------------------------------
Tree.prototype.NextDescendant = function() {
	this.curnode = this.curnode.sibling;
	return this.curnode;
}

//----------------------------------------------------------------------------------------
Tree.prototype.NextNonOGDescendant = function() {
	var q = this.NextDescendant();
	var done = false;
	while (!done) {
		if (!q) {
			done = true;
		}
		if (!done) {
			done = !q.marked;
		}
		if (!done) {
			q = this.NextDescendant();
		}
	}
	return q;
}

//----------------------------------------------------------------------------------------
Tree.prototype.MarkPath = function(p) {
	var q = p;
	while (q) {
		q.marked = true;
		q = q.ancestor;
	} 
}

//----------------------------------------------------------------------------------------
Tree.prototype.UnMarkPath = function(p) {
	var q = p;
	while (q) {
		q.marked = false;
		q = q.ancestor;
	} 
}

//----------------------------------------------------------------------------------------
Tree.prototype.ListOtherDesc = function(p) {
	var q = this.FirstDescendant(p);
	if (q.marked) {
		q = this.NextNonOGDescendant();
	}
	
	//console.log("NextNonOGDescendant=" + q.label);
	
	/*
	if (this.add_there.IsLeaf() || this.add_there.child) {
		this.add_there.sibling = q;
		q.ancestor = this.add_there.ancestor;
	} else {
		this.add_there.child = q;
		q.ancestor = this.add_there;
	}
	*/
	
	if (p != this.root) {
		this.add_there.child = q;
		q.ancestor = this.add_there;
	} else {
		this.add_there.sibling = q;
		q.ancestor = this.add_there.ancestor;
	}
	
	this.add_there = q;
	//console.log("q add_there=" + this.add_there.label);

	q = this.NextNonOGDescendant();
	while (q) {
	
		//console.log("NextNonOGDescendant=" + q.label);
	
		this.add_there.sibling = q;
		q.ancestor = this.add_there.ancestor;
		this.add_there = q;
		q = this.NextNonOGDescendant();
	}
	this.add_there.sibling = null;
	
	//console.log("ListOtherDesc add_there=" + this.add_there.label);
}

//----------------------------------------------------------------------------------------
Tree.prototype.ReRoot = function(outgroup, ingroup_edge, outgroup_edge) {
	if (!outgroup || (outgroup == this.root)) {
		return;
	}
	
	if (outgroup.ancestor == this.root) {
	
		// if tree had no branch lengths we'd ignore this case, but
		// for midpoint we may need to adjust edge lengths
		
		var ingroup = this.root.child;
		if (ingroup == outgroup) {
			ingroup = this.root.child.sibling;
		}
		
		ingroup.edge_length = ingroup_edge;
		outgroup.edge_length = outgroup_edge;
	
		return;
	}
	
	var counter = 0;
	
	this.MarkPath(outgroup);

	var ingroup = new Node('ingroup');
	ingroup.ancestor = outgroup.ancestor;
	
	this.add_there = ingroup;
	var q = outgroup.ancestor;
	
	// Split outgroup edge length among out and ingroup (does this require things to be binary?)
	//var half = outgroup.edge_length/2.0;
	ingroup.edge_length = ingroup_edge;
	outgroup.edge_length = outgroup_edge;
	
	while (q) {
		//console.log("ReRoot q=" + q.label);
	
		//console.log('into ListOtherDesc');
		
		this.ListOtherDesc(q);
		//console.log('outof ListOtherDesc');
		
		var previous_q = q;
		q = q.ancestor;
		
		if (q && (q != this.root)) {
			var p = new Node('x' + counter++);
			this.add_there.sibling = p;
			p.ancestor = this.add_there.ancestor;
			
			p.edge_length = previous_q.edge_length;
			p.label = previous_q.label;
			
			this.add_there = p;
		}
	}
	
	outgroup.ancestor.child = outgroup;
	outgroup.sibling = ingroup;
	this.root = outgroup.ancestor;
	
	// cleanup
	/*
	q = Root->GetAnc();
	while (q != NULL)
	{
		NodePtr p = q;
		q = q->GetAnc ();
		delete p;
	}
	*/
	
	this.root.ancestor = null;
	this.root.sibling = null;

	this.root.marked = false;
	outgroup.marked = false;

}

//----------------------------------------------------------------------------------------
Tree.prototype.MidpointRoot = function() {

	var outgroup = null;
	var ingroup_edge = 0.0;
	var outgroup_edge = 0.0;

	// get list of all leaves
	var counter = 0;
	var leaf_list = [];
	var n = new NodeIterator(this.root);
	var q = n.Begin();
	while (q != null)
	{
		if (q.IsLeaf())
		{
			leaf_list[counter++] = q;
		}
		q = n.Next();
	}

	// get max pairwise distance between leaves
	var max_pairwise = 0.0;
	var from = -1;
	var to = -1;

	for (var i = 1; i < counter; i++) {
		for (var j = 0; j < i; j++) {
			var p = leaf_list[i];
			var q = leaf_list[j];
		
			this.MarkPath(p);
		
			var sum = 0.0;
			while (q && !q.marked) {
				sum += q.edge_length;
				q = q.ancestor;
			}
		
			while (p != q) {
				sum += p.edge_length;
				p = p.ancestor;
			}
		
			this.UnMarkPath(leaf_list[i]);
		
			if (sum > max_pairwise) {
				from = leaf_list[i];
				to = leaf_list[j];
				max_pairwise = sum;
			}
		}
	}	

	//console.log("max_pairwise=" + max_pairwise + "[" + from.label + "," + to.label + "]");

	// find where where split the tree?
	var half = max_pairwise/2.0;

	outgroup = null;
	
	var path_one = 0.0;
	var path_two = 0.0;

	while ((path_one < half) && from) {
		path_two = path_one;
		path_one += from.edge_length;
		outgroup = from;
		from = from.ancestor;
	}

	if (path_one < half) {
		path_one = 0.0;
		path_two = 0.0;
		while ((path_one < half) && to) {
			path_two = path_one;
			path_one += to.edge_length;
			outgroup = to;
			to = to.ancestor;
		}
	}

	var extra = path_one - half;
	outgroup_edge = path_one - path_two - extra;
	ingroup_edge = extra;


	if (outgroup) {

		outgroup.label = 'OUTGROUP';
		// console.log("outgroup=" + outgroup.label);	
		// console.log('ingroup_edge=' + ingroup_edge + ', outgroup_edge=' + outgroup_edge);

		this.ReRoot(outgroup, ingroup_edge, outgroup_edge);

		//console.log('tree at end=' + this.WriteNewick());
	}
}

