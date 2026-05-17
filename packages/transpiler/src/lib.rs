use pest::Parser;
use pest_derive::Parser;
use wasm_bindgen::prelude::*;
use pest::iterators::Pair;

#[derive(Parser)]
#[grammar = "microc.pest"]
struct MicroCParser;

// ─── AST ───────────────────────────────────────────────
#[derive(Debug, Clone)]
enum Type { Int, Float, Void }

#[derive(Debug, Clone)]
enum Expr {
    Int(i64),
    Float(f64),
    Ident(String),
    BinOp(Box<Expr>, String, Box<Expr>),
    Assign(String, Box<Expr>),
    Call(String, Vec<Expr>),
    Neg(Box<Expr>),
}

#[derive(Debug, Clone)]
enum Stmt {
    VarDecl(Type, String, Option<Expr>),
    Expr(Expr),
    If(Expr, Vec<Stmt>, Option<Vec<Stmt>>),
    While(Expr, Vec<Stmt>),
    Return(Option<Expr>),
}

#[derive(Debug, Clone)]
struct FuncDecl {
    ret: Type,
    name: String,
    params: Vec<(Type, String)>,
    body: Vec<Stmt>,
}

#[derive(Debug, Clone)]
enum Decl {
    Func(FuncDecl),
    Var(Type, String, Option<Expr>),
}

fn parse_type(s: &str) -> Type {
    match s {
        "int" => Type::Int,
        "float" => Type::Float,
        _ => Type::Void,
    }
}

fn parse_expr(pair: Pair<Rule>) -> Expr {
    match pair.as_rule() {
        Rule::expr | Rule::assign => {
            let mut inner = pair.into_inner();
            let first = inner.next().unwrap();
            if let Some(second) = inner.next() {
                Expr::Assign(first.as_str().to_string(), Box::new(parse_expr(second)))
            } else {
                parse_expr(first)
            }
        }
        Rule::compare | Rule::add | Rule::mul => {
            let span_start = pair.as_span().start();
            let full_str = pair.as_str().to_string();
            let mut inner = pair.into_inner().collect::<Vec<_>>();
            if inner.len() == 1 {
                return parse_expr(inner.remove(0));
            }
            let left = inner.remove(0);
            let left_end = left.as_span().end();
            let right = inner.remove(0);
            let right_start = right.as_span().start();
            let op = full_str[left_end - span_start..right_start - span_start].trim().to_string();
            let left_expr = parse_expr(left);
            let right_expr = parse_expr(right);
            Expr::BinOp(Box::new(left_expr), op, Box::new(right_expr))
        }
        Rule::unary => {
            let mut inner = pair.into_inner();
            let first = inner.next().unwrap();
            if first.as_str() == "-" {
                Expr::Neg(Box::new(parse_expr(inner.next().unwrap())))
            } else {
                parse_expr(first)
            }
        }
        Rule::primary => parse_expr(pair.into_inner().next().unwrap()),
        Rule::float_lit => Expr::Float(pair.as_str().parse().unwrap()),
        Rule::int_lit => Expr::Int(pair.as_str().parse().unwrap()),
        Rule::ident => Expr::Ident(pair.as_str().to_string()),
        Rule::func_call => {
            let mut inner = pair.into_inner();
            let name = inner.next().unwrap().as_str().to_string();
            let args = inner.flat_map(|a| a.into_inner()).map(parse_expr).collect();
            Expr::Call(name, args)
        }
        _ => unreachable!("{:?}", pair.as_rule()),
    }
}

fn parse_stmt(pair: Pair<Rule>) -> Stmt {
    let pair = if pair.as_rule() == Rule::stmt {
        pair.into_inner().next().unwrap()
    } else {
        pair
    };
    
    match pair.as_rule() {
        Rule::var_decl => {
            let mut inner = pair.into_inner();
            let ty = parse_type(inner.next().unwrap().as_str());
            let name = inner.next().unwrap().as_str().to_string();
            let expr = inner.next().map(|e| parse_expr(e));
            Stmt::VarDecl(ty, name, expr)
        }
        Rule::expr_stmt => {
            let inner = pair.into_inner().next().unwrap();
            Stmt::Expr(parse_expr(inner))
        }
        Rule::return_stmt => {
            let inner = pair.into_inner().next();
            Stmt::Return(inner.map(|e| parse_expr(e)))
        }
        Rule::if_stmt => {
            let mut inner = pair.into_inner();
            let cond = parse_expr(inner.next().unwrap());
            let then = parse_block(inner.next().unwrap());
            let else_ = inner.next().map(|b| parse_block(b));
            Stmt::If(cond, then, else_)
        }
        Rule::while_stmt => {
            let mut inner = pair.into_inner();
            let cond = parse_expr(inner.next().unwrap());
            let body = parse_block(inner.next().unwrap());
            Stmt::While(cond, body)
        }
        _ => unreachable!("{:?}", pair.as_rule()),
    }
}

fn parse_block(pair: Pair<Rule>) -> Vec<Stmt> {
    pair.into_inner().map(parse_stmt).collect()
}

fn parse_program(source: &str) -> Result<Vec<Decl>, String> {
    let pairs = MicroCParser::parse(Rule::program, source)
        .map_err(|e| e.to_string())?;
    
    let mut decls = vec![];
    
    for pair in pairs {
        if pair.as_rule() == Rule::program {
            for decl_wrapper in pair.into_inner() {
                if decl_wrapper.as_rule() == Rule::EOI { continue; }
                // decl_wrapper is Rule::decl
                let inner = decl_wrapper.into_inner().next().unwrap();
                match inner.as_rule() {
                    Rule::func_decl => {
                        let mut fi = inner.into_inner();
                        let ret = parse_type(fi.next().unwrap().as_str());
                        let name = fi.next().unwrap().as_str().to_string();
                        let mut params = vec![];
                        let mut body = vec![];
                        for item in fi {
                            match item.as_rule() {
                                Rule::param_list => {
                                    for param in item.into_inner() {
                                        let mut pi = param.into_inner();
                                        let ty = parse_type(pi.next().unwrap().as_str());
                                        let nm = pi.next().unwrap().as_str().to_string();
                                        params.push((ty, nm));
                                    }
                                }
                                Rule::block => body = parse_block(item),
                                _ => {}
                            }
                        }
                        decls.push(Decl::Func(FuncDecl { ret, name, params, body }));
                    }
                    Rule::var_decl => {
                        let mut vi = inner.into_inner();
                        let ty = parse_type(vi.next().unwrap().as_str());
                        let name = vi.next().unwrap().as_str().to_string();
                        let expr = vi.next().map(parse_expr);
                        decls.push(Decl::Var(ty, name, expr));
                    }
                    _ => {}
                }
            }
        }
    }
    Ok(decls)
}

fn type_str(t: &Type) -> &str {
    match t {
        Type::Int => "int",
        Type::Float => "float",
        Type::Void => "void",
    }
}

fn gen_expr(expr: &Expr) -> String {
    match expr {
        Expr::Int(n) => n.to_string(),
        Expr::Float(f) => format!("{:.6}", f),
        Expr::Ident(s) => s.clone(),
        Expr::Neg(e) => format!("(-{})", gen_expr(e)),
        Expr::Assign(name, val) => format!("{} = {}", name, gen_expr(val)),
        Expr::BinOp(l, op, r) => format!("({} {} {})", gen_expr(l), op, gen_expr(r)),
        Expr::Call(name, args) => {
            let args_str: Vec<String> = args.iter().map(gen_expr).collect();
            format!("{}({})", name, args_str.join(", "))
        }
    }
}

fn gen_stmt(stmt: &Stmt, indent: usize) -> String {
    let pad = "    ".repeat(indent);
    match stmt {
        Stmt::VarDecl(ty, name, None) =>
            format!("{}{} {};", pad, type_str(ty), name),
        Stmt::VarDecl(ty, name, Some(e)) =>
            format!("{}{} {} = {};", pad, type_str(ty), name, gen_expr(e)),
        Stmt::Expr(e) =>
            format!("{}{};", pad, gen_expr(e)),
        Stmt::Return(None) =>
            format!("{}return;", pad),
        Stmt::Return(Some(e)) =>
            format!("{}return {};", pad, gen_expr(e)),
        Stmt::If(cond, then, else_) => {
            let mut s = format!("{}if ({}) {{\n", pad, gen_expr(cond));
            for st in then { s += &format!("{}\n", gen_stmt(st, indent + 1)); }
            s += &format!("{}}}", pad);
            if let Some(eb) = else_ {
                s += " else {\n";
                for st in eb { s += &format!("{}\n", gen_stmt(st, indent + 1)); }
                s += &format!("{}}}", pad);
            }
            s
        }
        Stmt::While(cond, body) => {
            let mut s = format!("{}while ({}) {{\n", pad, gen_expr(cond));
            for st in body { s += &format!("{}\n", gen_stmt(st, indent + 1)); }
            s += &format!("{}}}", pad);
            s
        }
    }
}

fn gen_decl(decl: &Decl) -> String {
    match decl {
        Decl::Var(ty, name, None) => format!("{} {};", type_str(ty), name),
        Decl::Var(ty, name, Some(e)) => format!("{} {} = {};", type_str(ty), name, gen_expr(e)),
        Decl::Func(f) => {
            let params: Vec<String> = f.params.iter()
                .map(|(t, n)| format!("{} {}", type_str(t), n))
                .collect();
            let mut s = format!("{} {}({}) {{\n", type_str(&f.ret), f.name, params.join(", "));
            for stmt in &f.body {
                s += &format!("{}\n", gen_stmt(stmt, 1));
            }
            s += "}";
            s
        }
    }
}

fn generate_c(decls: &[Decl]) -> String {
    let mut out = String::from("#include <stdio.h>\n\n");
    for decl in decls {
        out += &gen_decl(decl);
        out += "\n\n";
    }
    out
}

#[wasm_bindgen]
pub fn transpile(source: &str) -> String {
    match parse_program(source) {
        Ok(decls) => generate_c(&decls),
        Err(e) => format!("// Error:\n// {}", e),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_factorial() {
        let src = "int factorial(int n) {
            if (n <= 1) {
                return 1;
            }
            return n * factorial(n - 1);
        }";
        let result = parse_program(src).unwrap();
        let c_code = generate_c(&result);
        println!("{}", c_code);
    }
}