## shiny packages
suppressPackageStartupMessages(library("shiny"))
suppressPackageStartupMessages(library("shinyjs"))
suppressPackageStartupMessages(library("shinydashboard"))
suppressPackageStartupMessages(library("htmltools"))

# Define UI ----
ui <- fluidPage(
  shinyjs::useShinyjs(),
  
  div(id = "ui_main_page",
      dashboardPage(
        skin = "blue",
        
        dashboardHeader(title = tagList(icon("chart-line"), "GAM tool"),
                        tags$li(class = "dropdown",
                                style = "margin-right: 10px; margin-top: 8px;",
                                actionButton(inputId = "login_admin_btn",
                                             label = "Admin",
                                             icon = icon("user-shield")),
                                actionButton(inputId = "logout_btn",
                                             label = "Logout",
                                             icon = icon("sign-out-alt"))
                        )),
        
        ## Sidebar contents ----
        dashboardSidebar(
          sidebarMenu(
            id = "tabs", 
            menuItem("General information", 
                     tabName = "ginfo", 
                     icon = icon("info-circle")),
            menuItem("GAM manual", 
                     tabName = "gam_manual",
                     icon = icon("project-diagram")),
            menuItem("GAM previous", 
                     tabName = "gam_previous", 
                     icon = icon("history")),
            menuItem("Discussion of statistics", 
                     tabName = "discussion_of_statistics", 
                     icon = icon("comments"))
          )
        ),
        
        dashboardBody(
          
        )
      )
  )
)

# Server part ----
server <- function(input, output, session) {
  
}

# Run the app ----
shinyApp(ui = ui,
         server = server)
